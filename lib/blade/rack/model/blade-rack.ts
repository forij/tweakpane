import {InputBinding, InputBindingEvents} from '../../../common/binding/input';
import {
	MonitorBinding,
	MonitorBindingEvents,
} from '../../../common/binding/monitor';
import {Emitter} from '../../../common/model/emitter';
import {ViewPropsEvents} from '../../../common/model/view-props';
import {TpError} from '../../../common/tp-error';
import {View} from '../../../common/view/view';
import {Class, forceCast} from '../../../misc/type-util';
import {BladeController} from '../../common/controller/blade';
import {RackLikeController} from '../../common/controller/rack-like';
import {Blade, BladeEvents} from '../../common/model/blade';
import {BladePosition} from '../../common/model/blade-positions';
import {
	NestedOrderedSet,
	NestedOrderedSetEvents,
} from '../../common/model/nested-ordered-set';
import {InputBindingController} from '../../input-binding/controller/input-binding';
import {MonitorBindingController} from '../../monitor-binding/controller/monitor-binding';
import {RackController} from '../controller/rack';

/**
 * @hidden
 */
export interface BladeRackEvents {
	add: {
		bladeController: BladeController<View>;
		index: number;
		isRoot: boolean;
		sender: BladeRack;
	};
	remove: {
		bladeController: BladeController<View>;
		isRoot: boolean;
		sender: BladeRack;
	};

	inputchange: {
		bindingController: InputBindingController<unknown>;
		sender: BladeRack;
	};
	layout: {
		sender: BladeRack;
	};
	monitorupdate: {
		bindingController: MonitorBindingController<unknown>;
		sender: BladeRack;
	};
}

function findInputBindingController<In>(
	bcs: InputBindingController<In>[],
	b: InputBinding<In>,
): InputBindingController<In> | null {
	for (let i = 0; i < bcs.length; i++) {
		const bc = bcs[i];
		if (bc instanceof InputBindingController && bc.binding === b) {
			return bc;
		}
	}
	return null;
}

function findMonitorBindingController<In>(
	bcs: MonitorBindingController<In>[],
	b: MonitorBinding<In>,
): MonitorBindingController<In> | null {
	for (let i = 0; i < bcs.length; i++) {
		const bc = bcs[i];
		if (bc instanceof MonitorBindingController && bc.binding === b) {
			return bc;
		}
	}
	return null;
}

function findSubRack(bc: BladeController<View>): BladeRack | null {
	if (bc instanceof RackController) {
		return bc.rack;
	}
	if (bc instanceof RackLikeController) {
		return bc.rackController.rack;
	}
	return null;
}

function findSubBladeControllerSet(
	bc: BladeController<View>,
): NestedOrderedSet<BladeController<View>> | null {
	const rack = findSubRack(bc);
	return rack ? rack['bcSet_'] : null;
}

/**
 * @hidden
 */
export class BladeRack {
	public readonly emitter: Emitter<BladeRackEvents>;
	private readonly blade_: Blade | null;
	private bcSet_: NestedOrderedSet<BladeController<View>>;

	constructor(blade?: Blade) {
		this.onBladeChange_ = this.onBladeChange_.bind(this);
		this.onSetAdd_ = this.onSetAdd_.bind(this);
		this.onSetRemove_ = this.onSetRemove_.bind(this);
		this.onChildDispose_ = this.onChildDispose_.bind(this);
		this.onChildLayout_ = this.onChildLayout_.bind(this);
		this.onChildInputChange_ = this.onChildInputChange_.bind(this);
		this.onChildMonitorUpdate_ = this.onChildMonitorUpdate_.bind(this);
		this.onChildViewPropsChange_ = this.onChildViewPropsChange_.bind(this);
		this.onDescendantLayout_ = this.onDescendantLayout_.bind(this);
		this.onDescendantInputChange_ = this.onDescendantInputChange_.bind(this);
		this.onDescendaantMonitorUpdate_ = this.onDescendaantMonitorUpdate_.bind(
			this,
		);

		this.emitter = new Emitter();

		this.blade_ = blade ?? null;
		this.blade_?.emitter.on('change', this.onBladeChange_);

		this.bcSet_ = new NestedOrderedSet(findSubBladeControllerSet);
		this.bcSet_.emitter.on('add', this.onSetAdd_);
		this.bcSet_.emitter.on('remove', this.onSetRemove_);
	}

	get children(): BladeController<View>[] {
		return this.bcSet_.items;
	}

	public add(bc: BladeController<View>, opt_index?: number): void {
		if (bc.parent) {
			bc.parent.remove(bc);
		}
		bc['parent_'] = this;
		this.bcSet_.add(bc, opt_index);
	}

	public remove(bc: BladeController<View>): void {
		bc['parent_'] = null;
		this.bcSet_.remove(bc);
	}

	public find<B extends BladeController<View>>(controllerClass: Class<B>): B[] {
		return forceCast(
			this.bcSet_.allItems().filter((bc) => {
				return bc instanceof controllerClass;
			}),
		);
	}

	private onSetAdd_(ev: NestedOrderedSetEvents<BladeController<View>>['add']) {
		this.updatePositions_();

		const isRoot = ev.target === ev.root;
		this.emitter.emit('add', {
			bladeController: ev.item,
			index: ev.index,
			isRoot: isRoot,
			sender: this,
		});

		if (!isRoot) {
			return;
		}

		const bc = ev.item;
		bc.blade.emitter.on('dispose', this.onChildDispose_);
		bc.viewProps.emitter.on('change', this.onChildViewPropsChange_);
		bc.blade.emitter.on('change', this.onChildLayout_);

		if (bc instanceof InputBindingController) {
			bc.binding.emitter.on('change', this.onChildInputChange_);
		} else if (bc instanceof MonitorBindingController) {
			bc.binding.emitter.on('update', this.onChildMonitorUpdate_);
		} else {
			const rack = findSubRack(bc);
			if (rack) {
				const emitter = rack.emitter;
				emitter.on('layout', this.onDescendantLayout_);
				emitter.on('inputchange', this.onDescendantInputChange_);
				emitter.on('monitorupdate', this.onDescendaantMonitorUpdate_);
			}
		}
	}

	private onSetRemove_(
		ev: NestedOrderedSetEvents<BladeController<View>>['remove'],
	) {
		this.updatePositions_();

		const isRoot = ev.target === ev.root;
		this.emitter.emit('remove', {
			bladeController: ev.item,
			isRoot: isRoot,
			sender: this,
		});

		if (!isRoot) {
			return;
		}

		const bc = ev.item;
		if (bc instanceof InputBindingController) {
			bc.binding.emitter.off('change', this.onChildInputChange_);
		} else if (bc instanceof MonitorBindingController) {
			bc.binding.emitter.off('update', this.onChildMonitorUpdate_);
		} else {
			const rack = findSubRack(bc);
			if (rack) {
				const emitter = rack.emitter;
				emitter.off('layout', this.onDescendantLayout_);
				emitter.off('inputchange', this.onDescendantInputChange_);
				emitter.off('monitorupdate', this.onDescendaantMonitorUpdate_);
			}
		}
	}

	private updatePositions_(): void {
		const visibleItems = this.bcSet_.items.filter(
			(bc) => !bc.viewProps.get('hidden'),
		);
		const firstVisibleItem = visibleItems[0];
		const lastVisibleItem = visibleItems[visibleItems.length - 1];

		this.bcSet_.items.forEach((bc) => {
			const ps: BladePosition[] = [];
			if (bc === firstVisibleItem) {
				ps.push('first');

				if (!this.blade_ || this.blade_.positions.includes('veryfirst')) {
					ps.push('veryfirst');
				}
			}
			if (bc === lastVisibleItem) {
				ps.push('last');

				if (!this.blade_ || this.blade_.positions.includes('verylast')) {
					ps.push('verylast');
				}
			}
			bc.blade.positions = ps;
		});
	}

	private onChildLayout_(ev: BladeEvents['change']) {
		if (ev.propertyName === 'positions') {
			this.updatePositions_();
			this.emitter.emit('layout', {
				sender: this,
			});
		}
	}

	private onChildViewPropsChange_(_ev: ViewPropsEvents['change']) {
		this.updatePositions_();
		this.emitter.emit('layout', {
			sender: this,
		});
	}

	private onChildDispose_(_: BladeEvents['dispose']): void {
		const disposedUcs = this.bcSet_.items.filter((bc) => {
			return bc.blade.disposed;
		});
		disposedUcs.forEach((bc) => {
			this.bcSet_.remove(bc);
		});
	}

	private onChildInputChange_(ev: InputBindingEvents<unknown>['change']): void {
		const ibc = findInputBindingController(
			this.find(InputBindingController),
			ev.sender,
		);
		/* istanbul ignore next */
		if (!ibc) {
			throw TpError.shouldNeverHappen();
		}

		this.emitter.emit('inputchange', {
			bindingController: ibc,
			sender: this,
		});
	}

	private onChildMonitorUpdate_(
		ev: MonitorBindingEvents<unknown>['update'],
	): void {
		const mbc = findMonitorBindingController(
			this.find(MonitorBindingController),
			ev.sender,
		);
		/* istanbul ignore next */
		if (!mbc) {
			throw TpError.shouldNeverHappen();
		}

		this.emitter.emit('monitorupdate', {
			bindingController: mbc,
			sender: this,
		});
	}

	private onDescendantLayout_(_: BladeRackEvents['layout']) {
		this.updatePositions_();
		this.emitter.emit('layout', {
			sender: this,
		});
	}

	private onDescendantInputChange_(ev: BladeRackEvents['inputchange']) {
		this.emitter.emit('inputchange', {
			bindingController: ev.bindingController,
			sender: this,
		});
	}

	private onDescendaantMonitorUpdate_(ev: BladeRackEvents['monitorupdate']) {
		this.emitter.emit('monitorupdate', {
			bindingController: ev.bindingController,
			sender: this,
		});
	}

	private onBladeChange_(ev: BladeEvents['change']): void {
		if (ev.propertyName === 'positions') {
			this.updatePositions_();
		}
	}
}

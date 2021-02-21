import {InputBinding, InputBindingEvents} from '../plugin/common/binding/input';
import {
	MonitorBinding,
	MonitorBindingEvents,
} from '../plugin/common/binding/monitor';
import {Folder, FolderEvents} from '../plugin/common/model/folder';
import {
	UiContainer,
	UiContainerEvents,
} from '../plugin/common/model/ui-container';

export type InputEventName = 'change';
export type MonitorEventName = 'update';
export type FolderEventName = InputEventName | MonitorEventName | 'fold';

/**
 * @hidden
 */
export function handleInputBinding<In, Ex>({
	binding,
	eventName,
	handler,
}: {
	binding: InputBinding<In, Ex>;
	eventName: InputEventName;
	handler: (value: unknown) => void;
}) {
	if (eventName === 'change') {
		const emitter = binding.emitter;
		emitter.on('change', (ev: InputBindingEvents<In, Ex>['change']) => {
			handler(ev.sender.getValueToWrite(ev.rawValue));
		});
	}
}

/**
 * @hidden
 */
export function handleMonitorBinding<T>({
	binding,
	eventName,
	handler,
}: {
	binding: MonitorBinding<T>;
	eventName: MonitorEventName;
	handler: (value: unknown) => void;
}) {
	if (eventName === 'update') {
		const emitter = binding.emitter;
		emitter.on('update', (ev: MonitorBindingEvents<T>['update']) => {
			handler(ev.sender.target.read());
		});
	}
}

/**
 * @hidden
 */
export function handleFolder({
	eventName,
	folder,
	handler,
	uiContainer,
}: {
	eventName: FolderEventName;
	folder: Folder | null;
	handler: (value: unknown) => void;
	uiContainer: UiContainer;
}) {
	if (eventName === 'change') {
		const emitter = uiContainer.emitter;
		emitter.on('inputchange', (ev: UiContainerEvents['inputchange']) => {
			// TODO: Find more type-safe way
			handler((ev.inputBinding.getValueToWrite as any)(ev.value));
		});
	}
	if (eventName === 'update') {
		const emitter = uiContainer.emitter;
		emitter.on('monitorupdate', (ev: UiContainerEvents['monitorupdate']) => {
			handler(ev.monitorBinding.target.read());
		});
	}
	if (eventName === 'fold') {
		uiContainer.emitter.on('itemfold', (ev: UiContainerEvents['itemfold']) => {
			handler(ev.expanded);
		});
		folder?.emitter.on('change', (ev: FolderEvents['change']) => {
			if (ev.propertyName !== 'expanded') {
				return;
			}
			handler(ev.sender.expanded);
		});
	}
}
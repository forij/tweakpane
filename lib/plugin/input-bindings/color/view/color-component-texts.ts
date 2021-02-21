import {disposeElement} from '../../../common/disposing-util';
import {Color} from '../../../common/model/color';
import {PickedColor} from '../../../common/model/picked-color';
import {Value} from '../../../common/model/value';
import {PaneError} from '../../../common/pane-error';
import {ClassName} from '../../../common/view/class-name';
import {ValueView} from '../../../common/view/value';
import {View, ViewConfig} from '../../../common/view/view';
import {NumberFormatter} from '../../../common/writer/number';

interface Config extends ViewConfig {
	pickedColor: PickedColor;
}

type HtmlInputElements3 = [
	HTMLInputElement,
	HTMLInputElement,
	HTMLInputElement,
];

const className = ClassName('cctxts');
const FORMATTER = new NumberFormatter(0);

function createModeSelectElement(document: Document): HTMLSelectElement {
	const selectElem = document.createElement('select');
	const items = [
		{text: 'RGB', value: 'rgb'},
		{text: 'HSL', value: 'hsl'},
		{text: 'HSV', value: 'hsv'},
	];
	selectElem.appendChild(
		items.reduce((frag, item) => {
			const optElem = document.createElement('option');
			optElem.textContent = item.text;
			optElem.value = item.value;
			frag.appendChild(optElem);
			return frag;
		}, document.createDocumentFragment()),
	);
	return selectElem;
}

/**
 * @hidden
 */
export class ColorComponentTextsView extends View implements ValueView<Color> {
	public readonly pickedColor: PickedColor;
	public readonly modeSelectElement: HTMLSelectElement;
	private inputElems_: HtmlInputElements3 | null;

	constructor(document: Document, config: Config) {
		super(document, config);

		this.onValueChange_ = this.onValueChange_.bind(this);

		this.element.classList.add(className());

		const modeElem = document.createElement('div');
		modeElem.classList.add(className('m'));
		this.modeSelectElement = createModeSelectElement(document);
		this.modeSelectElement.classList.add(className('ms'));
		modeElem.appendChild(this.modeSelectElement);

		const modeMarkerElem = document.createElement('div');
		modeMarkerElem.classList.add(className('mm'));
		modeElem.appendChild(modeMarkerElem);

		this.element.appendChild(modeElem);

		const wrapperElem = document.createElement('div');
		wrapperElem.classList.add(className('w'));
		this.element.appendChild(wrapperElem);

		const inputElems = [0, 1, 2].map(() => {
			const inputElem = document.createElement('input');
			inputElem.classList.add(className('i'));
			inputElem.type = 'text';
			return inputElem;
		});
		inputElems.forEach((elem) => {
			wrapperElem.appendChild(elem);
		});
		this.inputElems_ = [inputElems[0], inputElems[1], inputElems[2]];

		this.pickedColor = config.pickedColor;
		this.pickedColor.emitter.on('change', this.onValueChange_);

		this.update();

		config.model.emitter.on('dispose', () => {
			if (this.inputElems_) {
				this.inputElems_.forEach((elem) => {
					disposeElement(elem);
				});
				this.inputElems_ = null;
			}
		});
	}

	get inputElements(): HtmlInputElements3 {
		if (!this.inputElems_) {
			throw PaneError.alreadyDisposed();
		}
		return this.inputElems_;
	}

	get value(): Value<Color> {
		return this.pickedColor.value;
	}

	public update(): void {
		const inputElems = this.inputElems_;
		if (!inputElems) {
			throw PaneError.alreadyDisposed();
		}

		const comps = this.pickedColor.value.rawValue.getComponents(
			this.pickedColor.mode,
		);
		comps.forEach((comp, index) => {
			const inputElem = inputElems[index];
			if (!inputElem) {
				return;
			}

			inputElem.value = FORMATTER.format(comp);
		});
	}

	private onValueChange_(): void {
		this.update();
	}
}
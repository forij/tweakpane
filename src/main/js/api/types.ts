export interface Point2dDimensionParams {
	max?: number;
	min?: number;
	step?: number;
}

export interface InputParamsOption<T> {
	text: string;
	value: T;
}

export interface InputParamsOptionDictionary<T> {
	[key: string]: T;
}

export interface InputParams {
	label?: string;
	max?: number;
	min?: number;
	options?: InputParamsOption<unknown>[] | InputParamsOptionDictionary<unknown>;
	presetKey?: string;
	step?: number;
	x?: Point2dDimensionParams;
	y?: Point2dDimensionParams;
}

export interface MonitorParams {
	count?: number;
	interval?: number;
	label?: string;
	max?: number;
	min?: number;
	multiline?: boolean;
	type?: string;
}

export interface ButtonParams {
	title: string;
}

export interface FolderParams {
	expanded?: boolean;
	title: string;
}
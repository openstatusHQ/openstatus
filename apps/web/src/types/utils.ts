export type Writeable<T> = { -readonly [P in keyof T]: T[P] };

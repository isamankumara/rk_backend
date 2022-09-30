export type Primitive =
  | bigint
  | boolean
  | null
  | number
  | string
  | symbol
  | undefined;

export type PlainObject = Record<string, Primitive>;

export type StringKeyValueObjectPair = [key: string, value: PlainObject];

export type JSONValue = Primitive | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}
// eslint-disable-next-line
export interface JSONArray extends Array<JSONValue> { }
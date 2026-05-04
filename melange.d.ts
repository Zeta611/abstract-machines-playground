declare module "melange/result" {
    const resultBrand: unique symbol
    export type Result<T, E> = { readonly [resultBrand]: [T, E] }
    export function
        fold<T, E, U1, U2>(
            onOk: (value: T) => U1,
            onErr: (error: E) => U2,
            result: Result<T, E>
        ): U1 | U2
}

declare module "melange/list" {
    const listBrand: unique symbol
    export type List<T> = { readonly [listBrand]: T }
}

declare module "melange/array" {
    import { List } from "melange/list"
    export function to_list<T>(arr: T[]): List<T>
    export function of_list<T>(list: List<T>): T[]
}
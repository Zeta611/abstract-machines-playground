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

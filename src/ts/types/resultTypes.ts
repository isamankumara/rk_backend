export type Result = {
    error: boolean,
    message?: string,
    result? : unknown
}

export type StatusResult = {
    error: boolean,
    status: number,
    message?: string,
    result? : unknown
}

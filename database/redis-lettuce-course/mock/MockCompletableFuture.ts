// mock/MockCompletableFuture.ts

export class MockCompletableFuture<T> {
  private resolved = false
  private rejected = false
  private value: T | undefined
  private error: Error | undefined
  private callbacks: ((v: T) => void)[] = []
  private errorCallbacks: ((e: Error) => void)[] = []

  then(fn: (v: T) => void): void {
    if (this.resolved) {
      fn(this.value as T)
    } else {
      this.callbacks.push(fn)
    }
  }

  catchError(fn: (e: Error) => void): void {
    if (this.rejected) {
      fn(this.error as Error)
    } else {
      this.errorCallbacks.push(fn)
    }
  }

  thenApply<U>(fn: (v: T) => U): MockCompletableFuture<U> {
    const next = new MockCompletableFuture<U>()
    this.then(v => next.complete(fn(v)))
    this.catchError(e => next.completeError(e))
    return next
  }

  complete(value: T): void {
    if (this.resolved || this.rejected) return
    this.resolved = true
    this.value = value
    for (const cb of this.callbacks) cb(value)
    this.callbacks = []
  }

  completeError(error: Error): void {
    if (this.resolved || this.rejected) return
    this.rejected = true
    this.error = error
    for (const cb of this.errorCallbacks) cb(error)
    this.errorCallbacks = []
  }

  isDone(): boolean {
    return this.resolved || this.rejected
  }
}

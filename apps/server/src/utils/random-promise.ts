export function fakePromiseWithRandomResolve() {
  return new Promise((resolve, reject) => {
    const randomTime = Math.floor(Math.random() * 1000);
    setTimeout(() => {
      const shouldResolve = Math.random() < 0; // 0.5
      if (shouldResolve) {
        resolve("Promise resolved successfully.");
      } else {
        reject(new Error("Promise rejected."));
      }
    }, randomTime);
  });
}

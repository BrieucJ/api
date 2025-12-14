export const stringToVector = (str: string, dim = 16): number[] => {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < str.length; i++) {
    vec[str.charCodeAt(i) % dim] += 1;
  }
  return vec.map((x) => x / str.length);
};

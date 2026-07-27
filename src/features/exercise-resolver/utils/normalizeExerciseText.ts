const removableCharacters = /[()[\]{}'"`~!@#$%^&*+=:;<>?|\\\-_/.,]/g;

export const normalizeExerciseText = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(removableCharacters, "")
    .replace(/\s+/g, "");

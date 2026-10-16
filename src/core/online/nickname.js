/** Generated nicknames such as `RedFox1`; shared by the app and the Worker, which picks them. */

export const COLORS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Brown",
  "Silver",
  "Golden",
  "White",
  "Black",
];

export const ANIMALS = [
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Cat",
  "Dog",
  "Lion",
  "Tiger",
  "Panda",
  "Koala",
  "Rabbit",
  "Horse",
  "Duck",
  "Frog",
  "Turtle",
  "Dolphin",
  "Whale",
  "Eagle",
  "Penguin",
  "Zebra",
];

/** @typedef {{color: number, animal: number, number: number}} NicknameParts Indices and number. */

/** @param {NicknameParts} parts */
export function formatNickname({ color, animal, number }) {
  return `${COLORS[color]}${ANIMALS[animal]}${number}`;
}

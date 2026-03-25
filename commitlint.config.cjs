/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  // Gitflow merge commits (--no-ff) and git revert are not conventional
  ignores: [
    (message) => /^Merge\s/.test(message),
    (message) => /^Revert\s/.test(message),
  ],
};

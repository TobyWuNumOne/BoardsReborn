if (!Object.groupBy) {
  Object.defineProperty(Object, 'groupBy', {
    value(items, callback) {
      const groups = Object.create(null);
      let index = 0;

      for (const item of items) {
        const key = callback(item, index++);

        if (!Object.hasOwn(groups, key)) {
          groups[key] = [];
        }

        groups[key].push(item);
      }

      return groups;
    },
  });
}

const { default: withNuxt } = await import('./.nuxt/eslint.config.mjs');

export default withNuxt({
  ignores: ['.nuxt/**', '.output/**', 'coverage/**'],
});

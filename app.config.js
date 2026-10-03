export default ({ config }) => {
  return {
    ...config,

    name: 'ScorpionTV',

    android: {
      ...config.android,
      package: 'com.scorpionhigt.ScorpionTV',
    },
  };
};
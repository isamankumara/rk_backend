import { Story, Topic, MinimalTheme, ThemeStoriesContainer } from '../../../ts/types/contentTypes';

export const reduceThemesStories = (
  themes: MinimalTheme[]
): ThemeStoriesContainer[] => {
  const userStoryList: ThemeStoriesContainer[] = themes.reduce(
    (
      themeStories: {
        title: string;
        data: Story[];
      }[],
      theme
    ) => {
      const thisThemeStories: Story[] = theme.topics.reduce(
        (topicStories: Story[], topic: Topic) => {
          topicStories.push(...topic.stories);
          return topicStories;
        },
        []
      );
      if (thisThemeStories.length > 0)
        themeStories.push({
          title: theme.title,
          data: thisThemeStories,
        });
      return themeStories;
    },
    []
  );
  return userStoryList;
};

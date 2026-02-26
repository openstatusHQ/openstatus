import { Tweet, type TweetProps } from "react-tweet";

export function MDXTweet(props: TweetProps) {
  return (
    <div data-theme="light" className="not-prose [&>div]:mx-auto">
      <Tweet {...props} />
    </div>
  );
}

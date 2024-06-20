import { Shell } from "@/components/dashboard/shell";

export const Testimonial = () => {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <figure className="mt-10">
        <blockquote className="text-center font-semibold text-2xl leading-8 sm:text-2xl sm:leading-9">
          <p>“Just don't give up on your users”</p>
        </blockquote>
        <figcaption className="mt-10">
          <div className="mt-4 flex items-center justify-center space-x-3 text-base">
            <div>
              <div className="font-semibold">Glauber Costa</div>
              <svg
                viewBox="0 0 2 2"
                width={3}
                height={3}
                aria-hidden="true"
                className="fill-gray-900"
              >
                <circle cx={1} cy={1} r={1} />
              </svg>
              <div className="text-muted-foreground">CEO of Turso</div>
            </div>
            <img
              className="h-10 w-10 rounded-full"
              src="/assets/checker/glauber.png"
              alt=""
            />
          </div>
        </figcaption>
      </figure>
    </div>
  );
};

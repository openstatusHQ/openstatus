import Image from "next/image";

export const Testimonial = () => {
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <figure className="grid gap-4">
        <blockquote className="text-center font-semibold text-xl leading-8 before:text-muted-foreground before:content-['“'] after:text-muted-foreground after:content-['”'] sm:text-2xl sm:leading-9">
          Just don't give up on your users
        </blockquote>
        <figcaption className="flex items-center justify-center space-x-3 text-base">
          <div className="text-sm">
            <div className="font-medium">Glauber Costa</div>
            <div className="text-muted-foreground">CEO of Turso</div>
          </div>
          <div className="relative h-10 w-10 overflow-hidden rounded-full border">
            <Image
              fill={true}
              src="/assets/checker/glauber.png"
              alt="Glauber Costa"
            />
          </div>
        </figcaption>
      </figure>
    </div>
  );
};

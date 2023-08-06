import { IncidentEvent } from "./event";

const array = new Array(4).fill(0);

export function IncidentHistory() {
  return (
    <ul role="list" className="sm:col-span-5">
      {array.map((_, i) => {
        return (
          <li key={i}>
            <div className="relative pb-8">
              {i !== array.length - 1 ? (
                <span
                  className="bg-accent absolute left-5 top-5 -ml-px h-full w-0.5"
                  aria-hidden="true"
                />
              ) : null}
              <IncidentEvent />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

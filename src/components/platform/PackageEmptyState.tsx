/** Empty state when an Overview tile opens a module that is not on the package. */
export function PackageEmptyState({
  module,
  detail,
}: {
  module: string;
  detail?: string;
}) {
  return (
    <div
      className="mx-auto max-w-md space-y-2 p-8 text-center"
      data-demo="package-empty"
    >
      <p className="text-sm font-semibold">Not on this package</p>
      <p className="text-sm text-muted-foreground">
        {detail ||
          `${module} is not on this location’s subscribed modules. The tile still works — this is not a blank page.`}
      </p>
    </div>
  );
}

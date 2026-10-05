export function StudioHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Orc <span className="text-primary">Dot</span>
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          A cute orc avatar maker in 2D and 3D. Mix tusks, war paint, gear and
          fluffy coats, then export as SVG, PNG, GIF, Lottie or GLB.
        </p>
      </div>
    </header>
  );
}

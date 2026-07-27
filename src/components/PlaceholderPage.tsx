type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold tracking-tight text-stone-50">{title}</h2>
      <p className="mt-2 text-stone-400">{description}</p>
      <div className="mt-8 rounded-lg border border-dashed border-stone-600 bg-stone-900/50 p-6 text-sm text-stone-500">
        Placeholder route — feature work lands in later branches.
      </div>
    </section>
  )
}

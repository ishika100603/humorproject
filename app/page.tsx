import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";

async function CaptionList() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: captions, error } = await supabase
        .from("captions")
        .select("id, image_url, caption")
        .order("id");

    if (error) return <p>Error: {error.message}</p>;

    return (
        <div className="grid gap-6">
            {captions?.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl border">
                    <img src={c.image_url} alt="" className="w-full" />
                    <p className="p-4 text-lg">{c.caption}</p>
                </div>
            ))}
        </div>
    );
}

export default function Home() {
    return (
        <main className="mx-auto max-w-2xl p-6">
            <h1 className="mb-6 text-3xl font-bold">Captions</h1>
            <Suspense fallback={<p>Loading captions…</p>}>
                <CaptionList />
            </Suspense>
        </main>
    );
}
import type { CompanyAnalysis } from "@/lib/validation/company-schema";

export function SocialLinks({ links }: { links: CompanyAnalysis["socialMedia"] }) {
  return (
    <section className="rounded-2xl border border-[#2a3a57] bg-[#121a2b] p-5">
      <h2 className="mb-4 text-xl font-semibold">Social Media</h2>
      {links.length === 0 ? (
        <p className="text-sm text-[#9aa8c7]">No social profiles were found.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {links.map((link) => (
            <li key={link.url} className="flex flex-wrap gap-2">
              <span className="w-28 font-medium">{link.platform}</span>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

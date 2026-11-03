import { Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { WhatsAppIcon } from '../components/icons';
import { JsonLd } from '../components/JsonLd';
import { OpenNowBadge } from '../components/OpenNowBadge';
import { PageHeader } from '../components/PageHeader';
import { ButtonLink } from '../components/ui/Button';
import { branches, email, phones, whatsappLink } from '../lib/clinic';
import { DAYS, dayLabel, formatIntervals, weeklyHours } from '../lib/hours';
import { dentistSchemas, pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Contact & Opening Hours | Expressions Dental Clinic, Goa',
    description:
      'Addresses, opening hours, phone numbers and directions for our clinics in Duler (Mapusa) and Candolim, Goa.',
    path: '/contact',
  });
}

export default function Contact() {
  return (
    <>
      <JsonLd data={dentistSchemas()} />
      <PageHeader
        crumbs={[{ name: 'Contact & hours', path: '/contact' }]}
        title="Contact & opening hours"
        intro="Two clinics in North Goa. Call, WhatsApp or get directions. We usually reply on WhatsApp during clinic hours."
      />

      <section className={`${container} grid gap-6 py-12 md:py-16 lg:grid-cols-2`}>
        {branches.map((branch) => {
          const hours = weeklyHours(branch.id);
          return (
            <article
              key={branch.id}
              className="flex flex-col rounded-[2rem] bg-white p-7 ring-1 ring-neutral-200 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{branch.shortName}</h2>
                <OpenNowBadge branchId={branch.id} />
              </div>
              <p className="mt-4 flex gap-3 leading-relaxed">
                <MapPin size={20} className="mt-1 shrink-0 text-primary-600" />
                <span>{branch.address}</span>
              </p>

              <h3 className="mt-6 flex items-center gap-2 font-semibold">
                <Clock size={18} className="text-primary-600" />
                Opening hours
              </h3>
              {hours ? (
                <table className="mt-3 w-full text-[0.95rem]">
                  <caption className="sr-only">Opening hours for {branch.shortName}</caption>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day} className="border-b border-neutral-100 last:border-0">
                        <th scope="row" className="py-2 text-left font-medium text-muted">
                          {dayLabel(day)}
                        </th>
                        <td className="py-2 text-right font-semibold">
                          {formatIntervals(hours[day])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 rounded-2xl bg-surface p-4 text-[0.95rem]">
                  Please call or WhatsApp before visiting to confirm today’s hours.
                </p>
              )}

              <div className="mt-auto grid gap-3 pt-7 sm:grid-cols-2">
                <ButtonLink href={branch.directionsHref} external variant="primary">
                  <Navigation size={18} />
                  Get directions
                </ButtonLink>
                <ButtonLink
                  href={whatsappLink(
                    `Hello Expressions Dental Clinic, I have a question about your ${branch.shortName} clinic.`,
                  )}
                  external
                  variant="secondary"
                >
                  <WhatsAppIcon size={20} className="text-[#128C4A]" />
                  WhatsApp
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </section>

      <section className={`${container} pb-16`}>
        <div className="grid gap-4 rounded-[2rem] bg-surface p-7 sm:grid-cols-3 sm:p-8">
          {phones.map((phone) => (
            <a
              key={phone.href}
              href={phone.href}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 font-semibold ring-1 ring-neutral-200 hover:ring-neutral-300"
            >
              <Phone size={20} className="text-primary-600" />
              {phone.display}
            </a>
          ))}
          <a
            href={`mailto:${email}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 font-semibold ring-1 ring-neutral-200 [overflow-wrap:anywhere] hover:ring-neutral-300"
          >
            <Mail size={20} className="shrink-0 text-primary-600" />
            Email us
          </a>
        </div>
      </section>
    </>
  );
}

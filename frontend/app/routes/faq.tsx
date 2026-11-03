import clinicData from '../../../content/clinic.json';
import { JsonLd } from '../components/JsonLd';
import { PageHeader } from '../components/PageHeader';
import { Accordion } from '../components/ui/Accordion';
import { faqSchema, pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Dental FAQs | Expressions Dental Clinic, Goa',
    description:
      'Answers to common questions about check-ups, flossing, children’s teeth, X-rays, sensitivity, whitening and dental emergencies.',
    path: '/faq',
  });
}

const faqs = clinicData.faqs.map((faq, index) => ({
  id: `faq-${index}`,
  q: faq.question,
  paragraphs: faq.answerParagraphs,
}));

export default function Faq() {
  return (
    <>
      <JsonLd data={faqSchema(faqs.map((faq) => ({ q: faq.q, a: faq.paragraphs.join(' ') })))} />
      <PageHeader
        crumbs={[{ name: 'FAQ', path: '/faq' }]}
        title="Frequently asked questions"
        intro="General dental questions our patients often ask. For advice about your own teeth, please book a check-up."
      />
      <section className={`${container} py-12 md:py-16`}>
        <Accordion
          className="max-w-3xl"
          items={faqs.map((faq) => ({
            id: faq.id,
            title: faq.q,
            content: (
              <div className="space-y-3">
                {faq.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ),
          }))}
        />
      </section>
    </>
  );
}

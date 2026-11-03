/**
 * "What's bothering you?" helper. Maps common complaints to treatments a dentist may discuss.
 * General guidance only (needs-doctor-review), never a diagnosis.
 */
export type Urgency = 'urgent' | 'soon' | 'routine';

export interface Symptom {
  id: string;
  label: string;
  urgency: Urgency;
  advice: string;
  treatments: string[];
  /** Booking form "reason" to preselect. */
  reason: string;
}

export const SYMPTOMS: Symptom[] = [
  {
    id: 'toothache',
    label: 'Toothache or sensitivity',
    urgency: 'soon',
    advice:
      'Pain with hot, cold or sweet food can come from a cavity, a crack or an inflamed nerve. Lingering pain, or pain that wakes you at night, should be checked soon.',
    treatments: ['dental-fillings', 'root-canal-treatment', 'dental-crowns'],
    reason: 'tooth-pain',
  },
  {
    id: 'swelling',
    label: 'Swelling or a gum boil',
    urgency: 'urgent',
    advice:
      'Swelling near a tooth often means infection. Call us today. If your face is swollen and you have a fever, or you have trouble breathing or swallowing, go to a hospital emergency department.',
    treatments: ['root-canal-treatment', 'tooth-extraction'],
    reason: 'tooth-pain',
  },
  {
    id: 'broken',
    label: 'Broken, chipped or knocked-out tooth',
    urgency: 'urgent',
    advice:
      'Come in as soon as you can. A knocked-out tooth has the best chance of being saved if it is seen quickly: keep it in milk or inside your cheek.',
    treatments: ['dental-fillings', 'dental-crowns', 'root-canal-treatment'],
    reason: 'tooth-pain',
  },
  {
    id: 'gums',
    label: 'Bleeding or receding gums',
    urgency: 'routine',
    advice:
      'Gums that bleed when brushing are usually an early sign of gum disease, which is very treatable when caught early.',
    treatments: ['tooth-scaling', 'gum-surgery'],
    reason: 'tooth-scaling',
  },
  {
    id: 'wisdom',
    label: 'Pain at the back of the jaw',
    urgency: 'soon',
    advice:
      'A partly erupted wisdom tooth can trap food and become inflamed. An X-ray shows whether it needs treatment.',
    treatments: ['impacted-wisdom-tooth-removal', 'tooth-scaling'],
    reason: 'impacted-wisdom-tooth-removal',
  },
  {
    id: 'missing',
    label: 'Missing teeth',
    urgency: 'routine',
    advice:
      'Replacing missing teeth helps you chew comfortably and stops neighbouring teeth from drifting. There are fixed and removable options.',
    treatments: ['dental-implants', 'dentures', 'dental-crowns'],
    reason: 'dental-implants',
  },
  {
    id: 'stains',
    label: 'Stained or discoloured teeth',
    urgency: 'routine',
    advice:
      'Surface stains often come off with a professional clean; deeper discolouration can be lightened or covered.',
    treatments: ['tooth-scaling', 'teeth-whitening', 'laminate-veneers'],
    reason: 'teeth-whitening',
  },
  {
    id: 'alignment',
    label: 'Crooked teeth or gaps',
    urgency: 'routine',
    advice:
      'Crowding, gaps and bite problems can be improved with orthodontic treatment or, for small changes, cosmetic options.',
    treatments: ['orthodontic-treatment', 'laminate-veneers', 'smile-designing'],
    reason: 'orthodontic-treatment',
  },
  {
    id: 'child',
    label: 'My child’s teeth',
    urgency: 'routine',
    advice:
      'Children should have their first check-up by their first birthday. We also help with habits like thumb sucking.',
    treatments: ['child-dental-care', 'dental-fillings'],
    reason: 'child-dental-care',
  },
];

export const URGENCY_COPY: Record<Urgency, { label: string; tone: 'brand' | 'warning' | 'info' }> =
  {
    urgent: { label: 'Please contact us today', tone: 'brand' },
    soon: { label: 'Book in the next few days', tone: 'warning' },
    routine: { label: 'Book a routine visit', tone: 'info' },
  };

export const getSymptom = (id: string | null) => SYMPTOMS.find((symptom) => symptom.id === id);

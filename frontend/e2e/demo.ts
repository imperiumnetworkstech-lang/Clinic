/** Fake demo staff created by backend/scripts/e2e-stack.ts on a throwaway database. */
const PASSWORD = 'e2e-demo-password-0001';

export const DEMO_STAFF = {
  owner: { email: 'demo.super-admin@expressions.test', password: PASSWORD },
  receptionist: { email: 'demo.receptionist@expressions.test', password: PASSWORD },
};

export const goaDate = (value: string | Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(value));

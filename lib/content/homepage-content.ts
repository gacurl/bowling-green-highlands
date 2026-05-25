export type HomepageFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type HomepageContent = {
  eyebrow: string;
  headline: string;
  supportingText: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  faqs: HomepageFaqItem[];
  pricingTitle: string;
  pricingText: string;
  policyTitle: string;
  policyText: string;
};

export const defaultHomepageContent: HomepageContent = {
  eyebrow: "Bowling Green Highlands",
  headline: "Request a farm stay date.",
  supportingText: "Choose an available date. We’ll follow up to confirm.",
  primaryCtaHref: "/reserve",
  primaryCtaLabel: "Request a date",
  faqs: [
    {
      id: "when-hear-back",
      question: "When will I hear back?",
      answer: "We review requests and follow up as soon as possible.",
    },
    {
      id: "is-request-confirmed",
      question: "Is my date confirmed after I submit?",
      answer: "No. Your request is reviewed before dates are confirmed.",
    },
    {
      id: "what-dates-requestable",
      question: "Which dates can I request?",
      answer: "Only dates currently marked available to request.",
    },
  ],
  pricingTitle: "Pricing",
  pricingText:
    "Pricing details are shared during follow-up after we review your request.",
  policyTitle: "Policy",
  policyText:
    "Requests are reviewed before dates are confirmed. We’ll follow up with next steps.",
};

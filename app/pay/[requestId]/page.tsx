import { PageShell } from "../../components/page-shell";
import { getEventTypeLabel } from "../../lib/event-type";
import {
  getCheckoutReturnState,
  getPaymentPageContent,
} from "../../lib/payment-page-content";
import { getPaymentRequestState } from "../../lib/payment-request";
import { getStripeCheckoutConfig } from "../../lib/stripe-config";
import { formatRequestedSlotLabel } from "../../../lib/requested-slot";

type PaymentPageProps = {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ checkout?: string }>;
};

export default async function PaymentPage({
  params,
  searchParams,
}: PaymentPageProps) {
  const { requestId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const paymentState = await getPaymentRequestState(
    requestId,
    getStripeCheckoutConfig() !== null,
  );
  const paymentAvailable = paymentState.kind === "available";
  const pageContent = getPaymentPageContent(
    paymentAvailable,
    getCheckoutReturnState(resolvedSearchParams.checkout),
  );

  return (
    <PageShell
      eyebrow="Payment"
      title={pageContent.title}
      description={pageContent.description}
      action={
        paymentAvailable ? (
          <form action={`/pay/${requestId}/checkout`} method="post">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
            >
              Pay securely
            </button>
          </form>
        ) : null
      }
    >
      {paymentAvailable ? (
        <div className="rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6">
          {pageContent.notice ? (
            <p className="mb-4 rounded-2xl border border-[#CFC3AE] bg-[#F6F0E6] px-4 py-3 text-sm font-medium text-[#2B2922]">
              {pageContent.notice}
            </p>
          ) : null}
          <dl className="space-y-4 text-sm text-[#4F4B3F]">
            <div>
              <dt className="font-medium text-[#2B2922]">Request</dt>
              <dd>{getEventTypeLabel(paymentState.request.eventType)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#2B2922]">Date and time</dt>
              <dd>{formatRequestedSlotLabel(paymentState.request.requestedDates)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-[#5F604E]">
            Stripe handles payment securely. Returning from Stripe does not confirm
            payment completion until Bowling Green Highlands verifies it.
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}

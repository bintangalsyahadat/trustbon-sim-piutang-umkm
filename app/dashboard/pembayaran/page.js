import { requireActiveMember } from "@/lib/session-guards";
import { getActiveKasbonOptions, getPaymentHistory } from "@/lib/payments";
import { formatIDR } from "@/lib/format";
import { PaymentManagement } from "./PaymentManagement";

export const metadata = { title: "Pembayaran — TrustBon" };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PembayaranPage() {
  // Both Owner and Kasir may record payments, mirroring createPayment.
  const { member } = await requireActiveMember();

  const [payments, kasbonOptions] = await Promise.all([
    getPaymentHistory({
      businessId: member.businessId,
      businessName: member.business?.name,
    }),
    getActiveKasbonOptions({
      businessId: member.businessId,
      businessName: member.business?.name,
    }),
  ]);

  // Map to plain serializable props: only strings and numbers cross the
  // server -> client boundary, and every number gets a pre-formatted label.
  const paymentItems = payments.map((payment) => ({
    id: payment.id,
    customerId: payment.customerId,
    customerName: payment.customerName,
    transactionId: payment.transactionId,
    transactionNumber: payment.transactionNumber,
    amountPaid: payment.amountPaid,
    amountPaidLabel: formatIDR(payment.amountPaid),
    paymentDate: payment.paymentDate,
    paymentDateLabel: dateFormatter.format(new Date(payment.paymentDate)),
    status: payment.status,
  }));

  const kasbonItems = kasbonOptions.map((kasbon) => ({
    transactionId: kasbon.transactionId,
    transactionNumber: kasbon.transactionNumber,
    customerId: kasbon.customerId,
    customerName: kasbon.customerName,
    customerPhone: kasbon.customerPhone,
    transactionDate: kasbon.transactionDate,
    transactionDateLabel: dateFormatter.format(new Date(kasbon.transactionDate)),
    dueDate: kasbon.dueDate,
    dueDateLabel: dateFormatter.format(new Date(kasbon.dueDate)),
    amount: kasbon.amount,
    amountLabel: formatIDR(kasbon.amount),
    paid: kasbon.paid,
    paidLabel: formatIDR(kasbon.paid),
    remaining: kasbon.remaining,
    remainingLabel: formatIDR(kasbon.remaining),
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <PaymentManagement payments={paymentItems} kasbonOptions={kasbonItems} />
    </div>
  );
}

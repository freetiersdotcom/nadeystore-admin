import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Truck,
  ExternalLink,
  AlertTriangle,
  Banknote,
} from 'lucide-react';
import { api, Order, RefundMethod } from '../lib/api';
import { formatPrice } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import clsx from 'clsx';
import { useT } from '../lib/locale-context';

const columnHelper = createColumnHelper<Order>();

const ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'refunded',
  'canceled',
] as const;

const REFUNDABLE_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const;

const REFUND_METHODS: RefundMethod[] = [
  'mtn_momo_dashboard',
  'mobile_money_transfer',
  'bank_transfer',
  'card_dashboard',
  'cash',
  'other',
];

// Currencies whose smallest unit is the whole currency (amounts are stored as-is).
const ZERO_DECIMAL = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);

export function Orders() {
  const queryClient = useQueryClient();
  const t = useT();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch orders
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['orders', statusFilter, needsReviewOnly],
    queryFn: () =>
      api.getOrders({
        limit: 100,
        status: statusFilter || undefined,
        needsReview: needsReviewOnly || undefined,
      }),
  });

  const orders = data?.items || [];

  // Update order mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateOrder>[1] }) =>
      api.updateOrder(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedOrder(updated);
    },
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: (id: string) => api.refundOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedOrder(null);
    },
  });

  // Manual refund recording
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('mtn_momo_dashboard');
  const [refundReference, setRefundReference] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  const { data: refundData } = useQuery({
    queryKey: ['order-refunds', selectedOrder?.id],
    queryFn: () => api.getOrderRefunds(selectedOrder!.id),
    enabled: !!selectedOrder,
  });

  const manualRefundMutation = useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof api.recordManualRefund>[1] }) =>
      api.recordManualRefund(vars.id, vars.body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-refunds', selectedOrder?.id] });
      setSelectedOrder((o) => (o ? { ...o, status: res.order_status } : o));
      setRefundOpen(false);
    },
    onError: (e: unknown) => {
      setRefundError(e instanceof Error ? e.message : String(e));
    },
  });

  function openRefundDialog() {
    setRefundAmount('');
    setRefundMethod('mtn_momo_dashboard');
    setRefundReference('');
    setRefundNote('');
    setRefundError(null);
    setRefundOpen(true);
  }

  function submitManualRefund() {
    if (!selectedOrder || !refundData) return;
    const currency = selectedOrder.amounts.currency;
    const factor = ZERO_DECIMAL.has((currency || '').toUpperCase()) ? 1 : 100;

    let amount_cents: number | undefined;
    if (refundAmount.trim() !== '') {
      const parsed = Number(refundAmount.replace(',', '.'));
      amount_cents = Math.round(parsed * factor);
      if (!Number.isFinite(parsed) || amount_cents <= 0 || amount_cents > refundData.remaining_cents) {
        setRefundError(t('orders.refund.invalidAmount'));
        return;
      }
    }
    if (!confirm(t('orders.refund.confirm'))) return;

    setRefundError(null);
    manualRefundMutation.mutate({
      id: selectedOrder.id,
      body: {
        amount_cents,
        method: refundMethod,
        reference: refundReference.trim() || undefined,
        note: refundNote.trim() || undefined,
      },
    });
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('number', {
        header: t('orders.col.order'),
        cell: (info) => (
          <span className="font-mono text-sm">
            {info.getValue() || info.row.original.id.slice(0, 8)}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.shipping?.name || '', {
        id: 'name',
        header: t('common.name'),
        cell: (info) => <span className="font-mono text-sm">{info.getValue() || '-'}</span>,
      }),
      columnHelper.accessor('customer_email', {
        header: t('orders.col.customer'),
        cell: (info) => <span className="font-mono text-sm">{info.getValue() || '-'}</span>,
      }),
      columnHelper.accessor('status', {
        header: t('orders.col.status'),
        cell: (info) => (
          <div className="flex items-center gap-2">
            <StatusBadge
              status={info.getValue()}
              label={t(`orders.status.${info.getValue()}` as Parameters<typeof t>[0])}
            />
            {info.row.original.needs_review && (
              <span
                title={t('orders.needsReview.banner')}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                <AlertTriangle size={12} />
                {t('orders.needsReview.badge')}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.amounts.total_cents, {
        id: 'total',
        header: t('orders.col.total'),
        cell: (info) => (
          <span className="font-mono text-sm">{formatPrice(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: t('orders.col.date'),
        cell: (info) => (
          <span className="font-mono text-sm">
            {new Date(info.getValue()).toLocaleDateString()}
          </span>
        ),
      }),
    ],
    [t]
  );

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 h-9">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {t('orders.title')}
        </h1>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
          disabled={isFetching}
          className="p-2 rounded hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
          style={{ color: 'var(--text-muted)' }}
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table card */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Filters */}
        <div className="flex items-center border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Search */}
          <div
            className="flex-1 flex items-center gap-2 px-4 py-3"
            style={{ color: 'var(--text-muted)' }}
          >
            <Search size={16} className="flex-shrink-0" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={t('orders.search')}
              className="bg-transparent border-0 font-mono text-sm w-full focus:outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-full px-4 py-3 font-mono text-sm bg-transparent border-0 border-l focus:outline-none cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              color: statusFilter ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            <option value="">{t('orders.filter.all')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`orders.status.${s}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>

          {/* Needs-review filter */}
          <button
            onClick={() => setNeedsReviewOnly((v) => !v)}
            className="h-full flex items-center gap-1.5 px-4 py-3 font-mono text-sm border-l focus:outline-none"
            style={{
              borderColor: 'var(--border)',
              color: needsReviewOnly ? 'var(--text)' : 'var(--text-muted)',
              background: needsReviewOnly ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
            }}
          >
            <AlertTriangle size={14} />
            {t('orders.filter.needsReview')}
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('orders.empty')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={clsx(
                        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide',
                        header.column.getCanSort() &&
                          'cursor-pointer select-none hover:bg-[var(--bg-hover)]'
                      )}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="ml-1">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronsUpDown size={14} className="opacity-30" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedOrder(row.original)}
                  className="cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `${t('orders.detail.title')} ${selectedOrder.number || selectedOrder.id.slice(0, 8)}`
            : t('orders.detail.title')
        }
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-5">
            {/* Status Badge */}
            <StatusBadge
              status={selectedOrder.status}
              label={t(`orders.status.${selectedOrder.status}` as Parameters<typeof t>[0])}
            />

            {/* Needs-review banner */}
            {selectedOrder.needs_review && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(217, 119, 6, 0.1)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  color: 'var(--text)',
                }}
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <p className="font-medium">{t('orders.needsReview.banner')}</p>
                  {selectedOrder.review_reason && (
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {selectedOrder.review_reason}
                    </p>
                  )}
                  <button
                    onClick={() =>
                      updateMutation.mutate({
                        id: selectedOrder.id,
                        data: { needs_review: false },
                      })
                    }
                    disabled={updateMutation.isPending}
                    className="mt-2 text-xs font-medium underline hover:no-underline disabled:opacity-50"
                    style={{ color: 'var(--text)' }}
                  >
                    {t('orders.needsReview.dismiss')}
                  </button>
                </div>
              </div>
            )}

            {/* Two column layout */}
            <div className="grid grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-4">
                {/* Customer */}
                <div className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                  <h4
                    className="text-xs font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('orders.col.customer')}
                  </h4>
                  {selectedOrder.shipping?.name && (
                    <p className="font-mono text-sm font-medium">{selectedOrder.shipping.name}</p>
                  )}
                  <p className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedOrder.customer_email}
                  </p>
                  {selectedOrder.shipping?.phone && (
                    <p
                      className="font-mono text-sm mt-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {selectedOrder.shipping.phone}
                    </p>
                  )}
                </div>

                {/* Shipping Address */}
                {selectedOrder.shipping?.address ? (
                  <div className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    <h4
                      className="text-xs font-medium uppercase tracking-wide mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('orders.detail.address')}
                    </h4>
                    <div className="font-mono text-sm">
                      {selectedOrder.shipping.name && (
                        <p className="font-medium">{selectedOrder.shipping.name}</p>
                      )}
                      {selectedOrder.shipping.address.line1 && (
                        <p>{selectedOrder.shipping.address.line1}</p>
                      )}
                      {selectedOrder.shipping.address.line2 && (
                        <p>{selectedOrder.shipping.address.line2}</p>
                      )}
                      <p>
                        {[
                          selectedOrder.shipping.address.city,
                          selectedOrder.shipping.address.state,
                          selectedOrder.shipping.address.postal_code,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {selectedOrder.shipping.address.country && (
                        <p>{selectedOrder.shipping.address.country}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {t('orders.detail.noShipping')}
                  </p>
                )}

                {/* Payment info */}
                {selectedOrder.stripe?.payment_intent_id && (
                  <div className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    <h4
                      className="text-xs font-medium uppercase tracking-wide mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('orders.detail.payment')}
                    </h4>
                    <p
                      className="text-xs font-mono break-all"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('orders.detail.sessionId')}: {selectedOrder.stripe.payment_intent_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Items */}
                <div className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                  <h4
                    className="text-xs font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('orders.detail.items')}
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-mono">{item.title}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                            {item.sku} × {item.qty}
                          </p>
                        </div>
                        <p className="font-mono">
                          {formatPrice(item.unit_price_cents * item.qty)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financials */}
                <div className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                  <h4
                    className="text-xs font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('orders.detail.financials')}
                  </h4>
                  <div className="space-y-1 text-sm font-mono">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>{t('orders.detail.subtotal')}</span>
                      <span>{formatPrice(selectedOrder.amounts.subtotal_cents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>{t('orders.detail.tax')}</span>
                      <span>{formatPrice(selectedOrder.amounts.tax_cents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>{t('orders.detail.shippingCost')}</span>
                      <span>
                        {selectedOrder.amounts.shipping_cents === 0
                          ? t('orders.detail.free')
                          : formatPrice(selectedOrder.amounts.shipping_cents)}
                      </span>
                    </div>
                    <div
                      className="flex justify-between pt-2 mt-2 border-t font-semibold"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span>{t('orders.detail.total')}</span>
                      <span>{formatPrice(selectedOrder.amounts.total_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Tracking */}
            <div
              className="grid grid-cols-2 gap-5 pt-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Status Update */}
              <div>
                <h4
                  className="text-xs font-medium uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('orders.col.status')}
                </h4>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => {
                    updateMutation.mutate({
                      id: selectedOrder.id,
                      data: { status: e.target.value },
                    });
                  }}
                  disabled={updateMutation.isPending}
                  className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`orders.status.${s}` as Parameters<typeof t>[0])}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tracking */}
              <div>
                <h4
                  className="text-xs font-medium uppercase tracking-wide mb-2 flex items-center gap-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Truck size={14} />
                  {t('orders.detail.tracking')}
                </h4>
                <input
                  type="text"
                  placeholder={t('orders.detail.trackingNumber')}
                  defaultValue={selectedOrder.tracking?.number || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedOrder.tracking?.number || '')) {
                      updateMutation.mutate({
                        id: selectedOrder.id,
                        data: { tracking_number: e.target.value },
                      });
                    }
                  }}
                  className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                {selectedOrder.tracking?.url && (
                  <a
                    href={selectedOrder.tracking.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm mt-2 hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    <ExternalLink size={14} />
                    {t('orders.detail.trackingUrl')}
                  </a>
                )}
              </div>
            </div>

            {/* Refund history */}
            {refundData && (refundData.items.length > 0 || refundData.refunded_cents > 0) && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h4
                  className="text-xs font-medium uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('orders.refund.history')}
                </h4>
                <ul className="space-y-2">
                  {refundData.items.map((r) => (
                    <li key={r.id} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono">
                          {formatPrice(r.amount_cents, selectedOrder.amounts.currency)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {r.source === 'manual'
                            ? t('orders.refund.sourceManual')
                            : t('orders.refund.sourceStripe')}
                          {r.method &&
                            ` · ${t(`orders.refund.method.${r.method}` as Parameters<typeof t>[0])}`}
                          {' · '}
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {(r.reference || r.note) && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {[r.reference, r.note].filter(Boolean).join(' — ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {t('orders.refund.remaining')}:{' '}
                  {formatPrice(refundData.remaining_cents, selectedOrder.amounts.currency)}
                </p>
              </div>
            )}

            {/* Footer: Timestamp + Refund */}
            <div
              className="flex items-center justify-between pt-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {t('common.createdAt')} {new Date(selectedOrder.created_at).toLocaleString()}
              </p>
              <div className="flex items-center gap-4">
                {(REFUNDABLE_STATUSES as readonly string[]).includes(selectedOrder.status) &&
                  (refundData?.remaining_cents ?? 1) > 0 && (
                    <button
                      onClick={openRefundDialog}
                      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Banknote size={14} />
                      {t('orders.refund.manual')}
                    </button>
                  )}
                {selectedOrder.status === 'paid' && selectedOrder.stripe?.payment_intent_id && (
                  <button
                    onClick={() => {
                      if (confirm(t('orders.detail.refundConfirm'))) {
                        refundMutation.mutate(selectedOrder.id);
                      }
                    }}
                    disabled={refundMutation.isPending}
                    className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    {refundMutation.isPending ? t('common.loading') : t('orders.detail.refund')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual refund dialog */}
      <Modal
        open={refundOpen && !!selectedOrder}
        onClose={() => setRefundOpen(false)}
        title={t('orders.refund.modalTitle')}
        size="sm"
      >
        {selectedOrder && (
          <div className="p-6 space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('orders.refund.help')}
            </p>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('orders.refund.amount')} ({selectedOrder.amounts.currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={
                  refundData
                    ? formatPrice(refundData.remaining_cents, selectedOrder.amounts.currency)
                    : ''
                }
                className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('orders.refund.amountHint')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('orders.refund.method')}
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`orders.refund.method.${m}` as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('orders.refund.reference')}
              </label>
              <input
                type="text"
                value={refundReference}
                maxLength={200}
                onChange={(e) => setRefundReference(e.target.value)}
                placeholder={t('orders.refund.referencePh')}
                className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                {t('orders.refund.note')}
              </label>
              <textarea
                value={refundNote}
                maxLength={500}
                rows={2}
                onChange={(e) => setRefundNote(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            {refundError && <p className="text-sm text-red-500">{refundError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRefundOpen(false)}
                className="px-4 py-2 text-sm rounded-lg hover:underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={submitManualRefund}
                disabled={manualRefundMutation.isPending || !refundData}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {manualRefundMutation.isPending ? t('common.loading') : t('orders.refund.submit')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

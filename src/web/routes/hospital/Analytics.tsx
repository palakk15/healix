import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { Card } from "../../components/base/Card";
import { ChartTable } from "../../components/hospital/ChartData";
import { StatCard } from "../../components/hospital/StatCard";
import { dashboardKey } from "../../hooks/useHospitalLive";

const axisStyle = { fontSize: 12, fill: "var(--color-ink-3-text)" };
const tooltipStyle = { borderRadius: 12, border: "1px solid var(--color-line)", background: "var(--color-surface)", fontSize: 13 };

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card as="section" aria-label={title} className="flex flex-col gap-3 !p-6">
      <h2 className="type-h3">{title}</h2>
      <p className="type-small">{description}</p>
      <div className="h-[280px] w-full">{children}</div>
    </Card>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const analytics = useQuery({ queryKey: [...dashboardKey, "analytics"], queryFn: () => backend.dashboard.analytics(), retry: 1 });
  const accuracy = useQuery({ queryKey: [...dashboardKey, "accuracy"], queryFn: () => backend.dashboard.accuracy(), retry: 1 });

  if (analytics.isPending || accuracy.isPending) return <main id="main"><p role="status" className="type-body">{t("hospital.loading")}</p></main>;
  if (analytics.isError || accuracy.isError) return <main id="main"><p role="alert" className="type-body">{t("hospital.error")}</p></main>;

  const predictedVsActual = analytics.data.predicted_vs_actual;
  const perHour = analytics.data.patients_per_hour;
  const better = accuracy.data.simple_mae_minutes > 0 ? Math.round((1 - accuracy.data.model_mae_minutes / accuracy.data.simple_mae_minutes) * 100) : 0;

  return (
    <main id="main" className="flex flex-col gap-6">
      <header>
        <h1 className="type-h2">{t("hospital.analyticsPage.title")}</h1>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <StatCard
          testId="mae-model"
          label={t("hospital.analyticsPage.modelError")}
          estimate={t("hospital.estimate")}
          value={t("hospital.minutes", { minutes: accuracy.data.model_mae_minutes.toFixed(1) })}
          hint={t("hospital.analyticsPage.modelErrorHint")}
        />
        <StatCard
          testId="mae-simple"
          label={t("hospital.analyticsPage.simpleError")}
          value={t("hospital.minutes", { minutes: accuracy.data.simple_mae_minutes.toFixed(1) })}
          hint={t("hospital.analyticsPage.betterBy", { percent: better })}
        />
      </div>

      <ChartCard title={t("hospital.analyticsPage.predictedVsActual")} description={t("hospital.analyticsPage.predictedVsActualHint")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={predictedVsActual} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" min" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="predicted" name={t("hospital.analyticsPage.predicted")} stroke="var(--color-accent)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="actual" name={t("hospital.analyticsPage.actual")} stroke="var(--color-ink)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <ChartTable
          caption={t("hospital.analyticsPage.predictedVsActual")}
          columns={[t("hospital.analyticsPage.hour"), t("hospital.analyticsPage.predicted"), t("hospital.analyticsPage.actual")]}
          rows={predictedVsActual.map((point) => [point.label, point.predicted, point.actual])}
        />
      </ChartCard>

      <ChartCard title={t("hospital.analyticsPage.accuracyDaily")} description={t("hospital.analyticsPage.accuracyDailyHint")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={accuracy.data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} tickFormatter={(value: string) => value.slice(5)} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" min" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="model_mae" name={t("hospital.analyticsPage.modelShort")} stroke="var(--color-accent)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="simple_mae" name={t("hospital.analyticsPage.simpleShort")} stroke="var(--color-ink-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <ChartTable
          caption={t("hospital.analyticsPage.accuracyDaily")}
          columns={[t("hospital.analyticsPage.date"), t("hospital.analyticsPage.modelShort"), t("hospital.analyticsPage.simpleShort")]}
          rows={accuracy.data.daily.map((day) => [day.date, day.model_mae, day.simple_mae])}
        />
      </ChartCard>

      <ChartCard title={t("hospital.analyticsPage.perHour")} description={t("hospital.analyticsPage.perHourHint")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perHour} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-stage)" }} />
            <Bar dataKey="patients" name={t("hospital.analyticsPage.patients")} fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <ChartTable
          caption={t("hospital.analyticsPage.perHour")}
          columns={[t("hospital.analyticsPage.hour"), t("hospital.analyticsPage.patients")]}
          rows={perHour.map((point) => [point.label, point.patients])}
        />
      </ChartCard>

      {analytics.data.synthetic || accuracy.data.synthetic ? <p data-testid="sample-note" className="type-small">{t("hospital.analyticsPage.sampleNote")}</p> : null}
    </main>
  );
}

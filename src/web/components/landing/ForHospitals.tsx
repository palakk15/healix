import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isLongWait, predictedWait, tokenLabel, type DemoQueueState } from "@core/domain/demoQueue";
import { cn } from "../../lib/cn";
import { Button } from "../base/Button";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";
import { Eyebrow } from "../base/Eyebrow";
import { Container } from "../layout/Container";
import { Reveal } from "../motion/Reveal";
import { RollingNumber } from "../motion/RollingNumber";

const headerCell = "type-label !leading-[1.6] border-b border-line py-3 text-left font-medium text-ink-3-text";
const bodyCell = "border-b border-line py-4 text-[14px] leading-[1.6] text-ink";

export function ForHospitals({ queue }: { queue: DemoQueueState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function openDashboard() {
    try {
      const { fetchMeta } = await import("@core/api/meta");
      const meta = await fetchMeta();
      if (meta.data_mode === "mock") {
        const { demoOtp, demoStaffPhone, loginWithPhone } = await import("../../lib/auth");
        await loginWithPhone(demoStaffPhone, demoOtp);
      }
    } catch {
      navigate("/hospital");
      return;
    }
    navigate("/hospital");
  }

  return (
    <section id="for-hospitals" className="scroll-mt-20 py-20 md:py-32">
      <Container className="grid items-center gap-10 md:grid-cols-12 md:gap-6">
        <Reveal className="md:col-span-5">
          <Eyebrow>{t("landing.hospitals.eyebrow")}</Eyebrow>
          <h2 className="type-h2 mt-4">
            <Trans i18nKey="landing.hospitals.title" components={{ i: <i /> }} />
          </h2>
          <p className="type-body mt-6 max-w-[400px]">{t("landing.hospitals.body")}</p>
          <Button variant="secondary" className="mt-8" onClick={() => void openDashboard()}>
            {t("landing.hospitals.cta")}
          </Button>
        </Reveal>

        <Reveal index={1} className="md:col-span-6 md:col-start-7">
          <Card className="md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="type-h3">{t("landing.hospitals.tableTitle")}</h3>
              <Chip>
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                {t("landing.hospitals.live")}
              </Chip>
            </div>
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{t("landing.hospitals.tableTitle")}</caption>
              <colgroup>
                <col style={{ width: "52%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={headerCell}>{t("landing.hospitals.colDoctor")}</th>
                  <th scope="col" className={headerCell}>{t("landing.hospitals.colNow")}</th>
                  <th scope="col" className={headerCell}>{t("landing.hospitals.colWaiting")}</th>
                  <th scope="col" className={cn(headerCell, "text-right")}>{t("landing.hospitals.colWait")}</th>
                </tr>
              </thead>
              <tbody aria-live="polite">
                {queue.doctors.map((doctor) => {
                  const long = isLongWait(doctor);
                  return (
                    <tr key={doctor.id}>
                      <td className={bodyCell}>
                        {doctor.name} · {t(`landing.hospitals.${doctor.specialty}`)}
                      </td>
                      <td className={cn(bodyCell, "type-data !leading-[1.6]")}>
                        <RollingNumber value={tokenLabel(doctor)} />
                      </td>
                      <td className={bodyCell}>
                        <RollingNumber value={doctor.waiting} />
                      </td>
                      <td className={cn(bodyCell, "type-data text-right !leading-[1.6]", long && "text-alert-text")}>
                        <RollingNumber value={predictedWait(doctor)} /> {t("landing.units.min")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Reveal>
      </Container>
    </section>
  );
}

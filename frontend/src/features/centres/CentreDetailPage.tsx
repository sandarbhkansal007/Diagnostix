import { ArrowLeft, LoaderCircle, MapPin, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError } from "../../lib/apiError";
import type { DiagnosticCentre } from "../dashboard/types";
import { fetchCentreById, fetchCentreTests } from "./centreService";

interface CentreTestSummary {
  readonly id: number;
  readonly test_name: string;
  readonly description: string | null;
  readonly price: string;
}

export function CentreDetailPage() {
  const { centreId } = useParams();
  const [centre, setCentre] = useState<DiagnosticCentre | null>(null);
  const [offers, setOffers] = useState<CentreTestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCentre() {
      const numericId = Number(centreId);
      if (!Number.isInteger(numericId)) {
        setErrorMessage("This centre could not be found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [nextCentre, nextOffers] = await Promise.all([
          fetchCentreById(numericId),
          fetchCentreTests(numericId),
        ]);
        setCentre(nextCentre);
        setOffers(nextOffers);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setErrorMessage("This centre could not be found.");
        } else if (error instanceof ApiError) {
          setErrorMessage("We couldn’t load this centre right now. Please try again.");
        } else if (error instanceof TypeError) {
          setErrorMessage("This centre is temporarily unavailable. Please try again.");
        } else {
          setErrorMessage("We couldn’t load this centre right now. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadCentre();
  }, [centreId]);

  if (isLoading) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading centre details">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading centre details…</span>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage}</p>
          <Link to={APP_ROUTES.centres}>Back to centres</Link>
        </div>
      </div>
    );
  }

  if (!centre) {
    return null;
  }

  return (
    <div className="catalogue-page">
      <header className="catalogue-header catalogue-header--detail">
        <div>
          <Link className="catalogue-back" to={APP_ROUTES.centres}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to centres
          </Link>
          <p className="catalogue-header__eyebrow">CENTRE DETAILS</p>
          <h1>{centre.name}</h1>
        </div>
      </header>

      <section className="catalogue-detail-summary">
        <div className="catalogue-card__top">
          <span className="catalogue-card__tag">Location</span>
          <MapPin size={18} aria-hidden="true" />
        </div>
        <p>{centre.location}</p>
      </section>

      <section className="catalogue-section">
        <h2>Available tests</h2>
        {offers.length === 0 ? (
          <p className="catalogue-empty-copy">No tests are currently listed for this centre.</p>
        ) : (
          <ul className="catalogue-offers">
            {offers.map((offer) => (
              <li className="catalogue-offer" key={offer.id}>
                <div>
                  <h3>{offer.test_name}</h3>
                  {offer.description && <p>{offer.description}</p>}
                </div>
                <div className="catalogue-offer__meta">
                  <Tag size={14} aria-hidden="true" />
                  <span>{offer.price}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

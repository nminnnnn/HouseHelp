import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "../../hooks/useAuth";
import HousekeeperCard from "./HousekeeperCard";

function buildQuery(filter = {}) {
  const params = new URLSearchParams();

  if (filter.services?.length) params.set("services", filter.services.join(","));
  if (filter.exactRating) params.set("exactRating", filter.exactRating);
  if (filter.maxPrice) params.set("maxPrice", filter.maxPrice);
  if (filter.available) params.set("available", filter.available);
  if (filter.topRated) params.set("topRated", "true");

  const query = params.toString();
  return query ? `?${query}` : "";
}

function matchesKeyword(housekeeper, keyword) {
  if (!keyword?.trim()) return true;

  const value = keyword.trim().toLowerCase();
  const services = housekeeper.services ? String(housekeeper.services).toLowerCase() : "";
  const fullName = housekeeper.fullName ? housekeeper.fullName.toLowerCase() : "";

  return services.includes(value) || fullName.includes(value);
}

function matchesServices(housekeeper, selectedServices = []) {
  if (!selectedServices.length) return true;

  const services = housekeeper.services ? String(housekeeper.services).toLowerCase() : "";
  return selectedServices.some((service) => services.includes(service.toLowerCase()));
}

function EmptyState({ user, total }) {
  return (
    <div className="housekeeper-empty-state">
      <strong>
        {user?.role === "housekeeper"
          ? "Khong tim thay nguoi giup viec khac phu hop."
          : "Khong tim thay nguoi giup viec phu hop."}
      </strong>
      <span>
        {total > 0
          ? `Co ${total} nguoi giup viec nhung khong khop voi bo loc hien tai.`
          : "Chua co du lieu nguoi giup viec trong he thong."}
      </span>
    </div>
  );
}

export default function HousekeeperList({ filter }) {
  const { user } = useAuth();
  const [housekeepers, setHousekeepers] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHousekeepers() {
      try {
        if (refreshTrigger === 0) setLoading(true);

        const response = await fetch(`http://localhost:5000/api/housekeepers${buildQuery(filter || {})}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const visibleData = user?.role === "housekeeper"
          ? data.filter((housekeeper) => housekeeper.userId !== user.id)
          : data;

        if (!cancelled) setHousekeepers(visibleData);
      } catch (err) {
        console.error("Error fetching housekeepers:", err);
        if (!cancelled && refreshTrigger === 0) setHousekeepers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHousekeepers();

    return () => {
      cancelled = true;
    };
  }, [filter, refreshTrigger, user]);

  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("housekeeper_status_updated", () => {
      setRefreshTrigger((current) => current + 1);
    });

    return () => socket.disconnect();
  }, []);

  const filteredHousekeepers = useMemo(() => {
    const activeFilter = filter || {};

    return housekeepers.filter((housekeeper) => {
      if (!matchesKeyword(housekeeper, activeFilter.keyword)) return false;

      if (
        activeFilter.exactRating &&
        (parseFloat(housekeeper.rating) < parseFloat(activeFilter.exactRating) ||
          parseFloat(housekeeper.rating) >= parseFloat(activeFilter.exactRating) + 1)
      ) {
        return false;
      }

      if (activeFilter.maxPrice && parseFloat(housekeeper.price) > parseFloat(activeFilter.maxPrice)) {
        return false;
      }

      if (activeFilter.available && housekeeper.available !== activeFilter.available) {
        return false;
      }

      if (activeFilter.topRated && !housekeeper.isTopRated) {
        return false;
      }

      return matchesServices(housekeeper, activeFilter.services);
    });
  }, [housekeepers, filter]);

  if (loading) {
    return (
      <div className="housekeeper-list">
        <div className="housekeeper-loading">Dang tai danh sach nguoi giup viec...</div>
      </div>
    );
  }

  return (
    <div className="housekeeper-list">
      {filteredHousekeepers.length === 0 ? (
        <EmptyState user={user} total={housekeepers.length} />
      ) : (
        filteredHousekeepers.map((housekeeper) => (
          <HousekeeperCard key={housekeeper.id} hk={housekeeper} />
        ))
      )}
    </div>
  );
}

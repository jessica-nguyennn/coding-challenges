const notice = document.querySelector("#notice");
const log = document.querySelector("#api-log");
const driversList = document.querySelector("#drivers-list");
const ridesList = document.querySelector("#rides-list");

function logRequest(method, path, status, body) {
    const time = new Date().toLocaleTimeString();
    const result = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    log.textContent = `[${time}] ${method} ${path} → ${status}\n${result}\n\n${log.textContent}`;
}

async function api(method, path, body, headers = {}) {
    const response = await fetch(path, {
        method,
        headers: {
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = response.status === 204 ? "" : await response.text();
    let result = text;
    if (text) {
        try {
            result = JSON.parse(text);
        } catch {
            result = text;
        }
    }
    logRequest(method, path, response.status, result);
    if (!response.ok) {
        throw new Error(result?.error || `Request failed (${response.status})`);
    }
    return result;
}

function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.hidden = false;
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => { notice.hidden = true; }, 5000);
}

function pill(status) {
    const safeStatus = String(status).toLowerCase().replaceAll("_", "-");
    return `<span class="pill pill-${safeStatus}">${escapeHtml(status)}</span>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    })[character]);
}

async function updateAvailability(driverId, status) {
    try {
        await api("PUT", `/drivers/${encodeURIComponent(driverId)}/availability`, { status });
        showNotice(`${driverId} is now ${status}.`);
        await refresh();
    } catch (error) {
        showNotice(error.message, true);
    }
}

async function updateLocation(driverId, form) {
    const values = new FormData(form);
    try {
        await api("PUT", `/drivers/${encodeURIComponent(driverId)}/location`, {
            latitude: Number(values.get("latitude")),
            longitude: Number(values.get("longitude"))
        });
        showNotice(`Location updated for ${driverId}.`);
        await refresh();
    } catch (error) {
        showNotice(error.message, true);
    }
}

function renderDrivers(drivers) {
    document.querySelector("#available-count").textContent =
        String(drivers.filter((driver) => driver.status === "AVAILABLE").length);

    if (drivers.length === 0) {
        driversList.innerHTML = '<div class="empty">No drivers found.</div>';
        return;
    }

    driversList.innerHTML = drivers.map((driver) => {
        const latitude = driver.location?.latitude ?? "";
        const longitude = driver.location?.longitude ?? "";
        const locationLabel = driver.location
            ? `${driver.location.latitude}, ${driver.location.longitude}`
            : "No location shared";
        const canSwitch = ["OFFLINE", "AVAILABLE"].includes(driver.status);

        return `<article class="driver-card">
            <div class="driver-top">
                <span class="driver-id">${escapeHtml(driver.id)}</span>
                ${pill(driver.status)}
            </div>
            <p class="driver-location">Location: ${escapeHtml(locationLabel)}</p>
            <form class="driver-location-form" data-driver="${escapeHtml(driver.id)}">
                <div class="driver-controls">
                    <label>Lat<input name="latitude" type="number" step="any" min="-90" max="90" value="${escapeHtml(latitude)}" placeholder="Latitude" required></label>
                    <label>Lng<input name="longitude" type="number" step="any" min="-180" max="180" value="${escapeHtml(longitude)}" placeholder="Longitude" required></label>
                    <button class="button button-outline button-small" type="submit">Save location</button>
                </div>
            </form>
            <div class="actions">
                <button class="button button-outline button-small" type="button" data-availability="AVAILABLE" data-driver="${escapeHtml(driver.id)}" ${driver.status === "AVAILABLE" || !canSwitch ? "disabled" : ""}>Set available</button>
                <button class="button button-outline button-small" type="button" data-availability="OFFLINE" data-driver="${escapeHtml(driver.id)}" ${driver.status === "OFFLINE" || !canSwitch ? "disabled" : ""}>Set offline</button>
            </div>
        </article>`;
    }).join("");

    driversList.querySelectorAll("[data-availability]").forEach((button) => {
        button.addEventListener("click", () => updateAvailability(
            button.dataset.driver,
            button.dataset.availability
        ));
    });
    driversList.querySelectorAll(".driver-location-form").forEach((form) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            updateLocation(form.dataset.driver, form);
        });
    });
}

function rideActions(ride) {
    const actions = [];
    if (ride.status === "MATCHING") {
        actions.push(`<button class="button button-outline button-small" data-action="dispatch" data-ride="${escapeHtml(ride.id)}">Retry dispatch</button>`);
    }
    if (["REQUESTED", "MATCHING", "DRIVER_ASSIGNED", "DRIVER_ACCEPTED"].includes(ride.status)) {
        actions.push(`<button class="button button-danger button-small" data-action="cancel" data-ride="${escapeHtml(ride.id)}">Cancel ride</button>`);
    }
    if (ride.status === "DRIVER_ACCEPTED") {
        actions.push(`<button class="button button-primary button-small" data-action="complete" data-ride="${escapeHtml(ride.id)}">Complete ride</button>`);
    }
    return actions.join("");
}

async function renderRide(ride) {
    const card = document.createElement("article");
    card.className = "ride-card";
    const offers = await api("GET", `/rides/${encodeURIComponent(ride.id)}/offers`);
    card.innerHTML = `<div class="ride-top">
            <strong>Ride ${escapeHtml(ride.id)}</strong>
            ${pill(ride.status)}
        </div>
        <div class="ride-meta">
            <span>Passenger: <strong>${escapeHtml(ride.passengerId)}</strong></span>
            <span>Driver: <strong>${escapeHtml(ride.assignedDriverId || "—")}</strong></span>
            <span>Pickup: ${escapeHtml(`${ride.pickup.latitude}, ${ride.pickup.longitude}`)}</span>
        </div>
        <div class="actions">${rideActions(ride)}</div>
        <div class="offer-list">
            ${offers.length ? offers.map((offer) => `<div class="offer-row">
                <div class="offer-info"><strong>Offer to ${escapeHtml(offer.driverId)}</strong>${pill(offer.status)}<span>${new Date(offer.expiresAt).toLocaleTimeString()}</span></div>
                ${offer.status === "PENDING" ? `<div class="actions">
                    <button class="button button-primary button-small" data-action="accept" data-ride="${escapeHtml(ride.id)}" data-offer="${escapeHtml(offer.id)}" data-driver="${escapeHtml(offer.driverId)}">Accept</button>
                    <button class="button button-outline button-small" data-action="reject" data-ride="${escapeHtml(ride.id)}" data-offer="${escapeHtml(offer.id)}" data-driver="${escapeHtml(offer.driverId)}">Reject</button>
                </div>` : ""}
            </div>`).join("") : '<span class="helper">No offers yet.</span>'}
        </div>`;
    return card;
}

async function performRideAction(button) {
    const rideId = encodeURIComponent(button.dataset.ride);
    const action = button.dataset.action;
    try {
        if (action === "accept" || action === "reject") {
            await api("POST", `/rides/${rideId}/offers/${encodeURIComponent(button.dataset.offer)}/${action}`, {
                driverId: button.dataset.driver
            });
        } else if (action === "dispatch") {
            await api("POST", `/rides/${rideId}/dispatch`);
        } else {
            await api("POST", `/rides/${rideId}/${action}`);
        }
        showNotice(`Ride ${button.dataset.ride}: ${action} completed.`);
        await refresh();
    } catch (error) {
        showNotice(error.message, true);
        await refresh();
    }
}

async function renderRides(rides) {
    document.querySelector("#ride-count").textContent = String(rides.length);
    document.querySelector("#active-count").textContent = String(
        rides.filter((ride) => !["COMPLETED", "CANCELLED"].includes(ride.status)).length
    );
    if (rides.length === 0) {
        ridesList.innerHTML = '<div class="empty">No rides yet. Request one above to start dispatch.</div>';
        return;
    }

    ridesList.replaceChildren();
    for (const ride of [...rides].reverse()) {
        ridesList.append(await renderRide(ride));
    }
    ridesList.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => performRideAction(button));
    });
}

async function refresh() {
    try {
        const [drivers, rides] = await Promise.all([
            api("GET", "/drivers"),
            api("GET", "/rides")
        ]);
        renderDrivers(drivers);
        await renderRides(rides);
    } catch (error) {
        showNotice(error.message, true);
    }
}

document.querySelector("#ride-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = {
        passengerId: values.get("passengerId").trim(),
        pickup: {
            latitude: Number(values.get("pickupLatitude")),
            longitude: Number(values.get("pickupLongitude"))
        },
        destination: {
            latitude: Number(values.get("destinationLatitude")),
            longitude: Number(values.get("destinationLongitude"))
        }
    };

    try {
        const idempotencyKey = crypto.randomUUID();
        const result = await api("POST", "/rides", body, {
            "Idempotency-Key": idempotencyKey
        });
        showNotice(`Ride ${result.id} requested. Dispatch queued asynchronously.`);
        await refresh();
    } catch (error) {
        showNotice(error.message, true);
    }
});

document.querySelector("#refresh-button").addEventListener("click", refresh);
refresh();
window.setInterval(refresh, 2000);

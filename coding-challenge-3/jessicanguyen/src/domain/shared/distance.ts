import { Location } from "./location.js";

const EARTH_RADIUS_KM = 6371;

export function calculateDistance(
    from: Location,
    to: Location
): number {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;

    const latitudeDifference = toRadians(
        to.latitude - from.latitude
    );

    const longitudeDifference = toRadians(
        to.longitude - from.longitude
    );

    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    const centralAngle = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return EARTH_RADIUS_KM * centralAngle;
}
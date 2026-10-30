import type { PassengerRepository } from "../../application/ports/passenger-repository.js";

export class InMemoryPassengerRepository implements PassengerRepository {
    private passengers = new Set(["P001"]);

    exists(passengerId: string): boolean {
        return this.passengers.has(passengerId);
    }
}
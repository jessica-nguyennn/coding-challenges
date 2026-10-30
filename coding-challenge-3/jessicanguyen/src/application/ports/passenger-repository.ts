export interface PassengerRepository {
    exists(passengerId: string): boolean;
}
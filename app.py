def get_iat(r):

    if r < 0.2: return 1
    if r < 0.5: return 4
    return 6

def get_st(r):
    if r < 0.3: return 2
    return 4

def run_simulation_day(day_num, num_customers):

    header = f"{'Cust No':<8} | {'R(IAT)':<8} | {'IAT':<5} | {'Arr Time':<9} | {'R(ST)':<8} | {'ST':<4} | {'Start':<6} | {'End':<6} | {'Wait':<5} | {'Idle':<5}"
    print(f"\n--- SIMULATION DAY {day_num} ---")
    print(header)
    print("-" * len(header))

    prev_end_time = 0
    prev_arrival = 0
    total_wait = 0

    from random import random

    for i in range(1, num_customers + 1):
        r_iat = random()
        iat = get_iat(r_iat) if i > 1 else 0
        r_st = random()
        st = get_st(r_st)

        arrival = prev_arrival + iat
        start = max(arrival, prev_end_time)
        end = start + st
        wait = max(0, start - arrival)
        idle = max(0, arrival - prev_end_time) if i > 1 else 0

        total_wait += wait
        print(f"{i:<8} | {r_iat:<8.4f} | {iat:<5} | {arrival:<9} | {r_st:<8.4f} | {st:<4} | {start:<6} | {end:<6} | {wait:<5} | {idle:<5}")

        prev_end_time = end
        prev_arrival = arrival

    return total_wait / num_customers


days = int(input("Enter the number of days: "))
customers_per_day = int(input("Enter the number of customers per day: "))
wait_threshold = 1.0

daily_averages = []

for day in range(1, days + 1):
    avg = run_simulation_day(day, customers_per_day)
    daily_averages.append(avg)


global_avg_wait = sum(daily_averages) / len(daily_averages)

print(f"\n{'='*50}")
print(f"FINAL SIMULATION SUMMARY")
print(f"{'='*50}")
print(f"Simulation Duration : {days} days")
print(f"Average Wait Time   : {global_avg_wait:.2f} minutes")
print(f"Capacity Threshold  : {wait_threshold:.2f} minutes")
print("-" * 50)

if global_avg_wait > wait_threshold:
    print("VERDICT: [ACTION REQUIRED]")
    print("Recommendation: INSTALL ADDITIONAL ATM.")
    print("Reasoning: Average customer wait time exceeds the acceptable threshold.")
else:
    print("VERDICT: [STATUS OPTIMAL]")
    print("Recommendation: NO ADDITIONAL ATM REQUIRED.")
    print("Reasoning: Current infrastructure handles volume within acceptable limits.")
print(f"{'='*50}\n")
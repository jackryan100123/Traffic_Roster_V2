from django.core.management.base import BaseCommand
from police_roster.models import Roster, RosterAssignment, Policeman, Area
from django.db.models import Count, Q
from collections import defaultdict
import traceback
import json

class Command(BaseCommand):
    help = 'Check rosters, policemen counts, and analyze shortages'

    def add_arguments(self, parser):
        parser.add_argument('--roster_id', type=int, help='ID of specific roster to analyze (overrides active roster check)')

    def handle(self, *args, **options):
        try:
            # Count total policemen and breakdown by rank
            self.stdout.write(self.style.SUCCESS("=== POLICEMEN COUNTS ==="))
            total_policemen = Policeman.objects.count()
            self.stdout.write(f"Total policemen: {total_policemen}")
            
            # Filter by field duty and not fixed
            field_policemen = Policeman.objects.filter(preferred_duty='FIELD', has_fixed_duty=False)
            self.stdout.write(f"Field policemen (not fixed): {field_policemen.count()}")
            
            self.stdout.write("\nBy Rank:")
            all_rank_counts = {}
            field_rank_counts = {}
            for rank, name in Policeman.RANK_CHOICES:
                all_count = Policeman.objects.filter(rank=rank).count()
                field_count = field_policemen.filter(rank=rank).count()
                all_rank_counts[rank] = all_count
                field_rank_counts[rank] = field_count
                self.stdout.write(f"{name}: {all_count} total, {field_count} available for field duty")
                
            # Count policemen with fixed duties
            fixed_duty_count = Policeman.objects.filter(has_fixed_duty=True).count()
            self.stdout.write(f"\nPolicemen with fixed duties: {fixed_duty_count}")
            
            # Count static duty
            static_duty_count = Policeman.objects.filter(preferred_duty='STATIC').count() 
            self.stdout.write(f"Policemen with static duty: {static_duty_count}")
            
            # DRIVER ANALYSIS
            self.stdout.write(self.style.SUCCESS("\n=== DRIVER ANALYSIS ==="))
            all_drivers = Policeman.objects.filter(is_driver=True)
            field_drivers = all_drivers.filter(preferred_duty='FIELD', has_fixed_duty=False)
            drivers_count = all_drivers.count()
            field_drivers_count = field_drivers.count()
            self.stdout.write(f"Total drivers: {drivers_count}")
            self.stdout.write(f"Field drivers (not fixed): {field_drivers_count}")
            
            # Drivers by rank
            self.stdout.write("\nDrivers by Rank:")
            for rank, name in Policeman.RANK_CHOICES:
                rank_drivers = all_drivers.filter(rank=rank).count()
                rank_field_drivers = field_drivers.filter(rank=rank).count()
                if rank_drivers > 0:
                    self.stdout.write(f"  {name}: {rank_drivers} total, {rank_field_drivers} available for field duty")
            
            # Check for specific roster ID or get active rosters
            roster_id = options.get('roster_id')
            if roster_id:
                rosters = Roster.objects.filter(id=roster_id)
                if not rosters.exists():
                    self.stdout.write(self.style.ERROR(f"No roster found with ID {roster_id}"))
                    return
                roster_title = f"ROSTER #{roster_id}"
            else:
                rosters = Roster.objects.filter(is_active=True).order_by('-id')
                roster_title = "ACTIVE ROSTERS"
            
            self.stdout.write("\n" + self.style.SUCCESS(f"=== {roster_title} ==="))
            
            if not rosters.exists():
                self.stdout.write("No rosters found.")
            
            for roster in rosters:
                try:
                    self.stdout.write(f"\nRoster #{roster.id}: {roster.name}")
                    self.stdout.write(f"  Is Active: {roster.is_active}")
                    self.stdout.write(f"  Is Pending: {roster.is_pending}")
                    self.stdout.write(f"  Created At: {roster.created_at}")
                    
                    # Count assignments by rank
                    assignments = RosterAssignment.objects.filter(roster=roster)
                    total_assignments = assignments.count()
                    self.stdout.write(f"  Total Assignments: {total_assignments}")
                    
                    # Driver assignment analysis
                    driver_assignments = assignments.filter(policeman__is_driver=True)
                    assigned_drivers = driver_assignments.count()
                    self.stdout.write(f"  Drivers assigned: {assigned_drivers}")
                    
                    # Check driver assignment by rank
                    self.stdout.write("  Assigned drivers by rank:")
                    for rank, name in Policeman.RANK_CHOICES:
                        rank_drivers_assigned = driver_assignments.filter(policeman__rank=rank).count()
                        if rank_drivers_assigned > 0:
                            self.stdout.write(f"    {name}: {rank_drivers_assigned}")
                    
                    self.stdout.write("  Assignments by Rank:")
                    rank_assignments = defaultdict(int)
                    for assignment in assignments:
                        if assignment.policeman:
                            rank_assignments[assignment.policeman.rank] += 1
                    
                    for rank, name in Policeman.RANK_CHOICES:
                        self.stdout.write(f"    {name}: {rank_assignments[rank]}")
                    
                    # Inspect structure of unfulfilled_requirements
                    unfulfilled = roster.unfulfilled_requirements
                    if unfulfilled:
                        self.stdout.write("  Unfulfilled Requirements:")
                        # Check unfulfilled data type and structure
                        self.stdout.write(f"    Data type: {type(unfulfilled).__name__}")
                        
                        if isinstance(unfulfilled, str):
                            try:
                                unfulfilled = json.loads(unfulfilled)
                                self.stdout.write(f"    Parsed JSON to: {type(unfulfilled).__name__}")
                            except json.JSONDecodeError:
                                self.stdout.write("    Failed to parse JSON")
                        
                        total_unfulfilled = 0
                        driver_unfulfilled = 0
                        
                        # New format from generate_roster.py - check for 'areas' and 'totals' keys
                        if isinstance(unfulfilled, dict) and 'areas' in unfulfilled:
                            # Handle new dictionary format with areas and totals
                            areas = unfulfilled.get('areas', [])
                            
                            if areas:
                                for area_data in areas:
                                    area_name = area_data.get('area_name', 'Unknown Area')
                                    zone_name = area_data.get('zone_name', '')
                                    full_area_name = f"{area_name} ({zone_name})" if zone_name else area_name
                                    unfulfilled_items = area_data.get('unfulfilled', [])
                                    
                                    if unfulfilled_items:
                                        self.stdout.write(f"    {full_area_name}:")
                                        for req in unfulfilled_items:
                                            rank = req.get('display', req.get('rank', 'Unknown'))
                                            count = req.get('count', 0)
                                            if count > 0:
                                                self.stdout.write(f"      {rank}: {count}")
                                                total_unfulfilled += count
                                                if rank == 'Driver':
                                                    driver_unfulfilled += count
                        
                        # Also check old format for backwards compatibility
                        elif isinstance(unfulfilled, dict):
                            # Handle dictionary format
                            for area_name, requirements in unfulfilled.items():
                                if area_name == 'reserved':
                                    continue  # Skip reserved officers section
                                
                                if isinstance(requirements, dict):
                                    area_total = sum(requirements.values())
                                    total_unfulfilled += area_total
                                    # Check for driver requirements
                                    if 'Driver' in requirements:
                                        driver_unfulfilled += requirements['Driver']
                                    
                                    if area_total > 0:
                                        self.stdout.write(f"    {area_name}:")
                                        for rank, count in requirements.items():
                                            if count > 0:
                                                self.stdout.write(f"      {rank}: {count}")
                        elif isinstance(unfulfilled, list):
                            # Handle list format
                            for item in unfulfilled:
                                if isinstance(item, dict) and 'area' in item and 'requirements' in item:
                                    area_name = item['area']
                                    requirements = item['requirements']
                                    area_total = sum(requirements.values()) if isinstance(requirements, dict) else 0
                                    total_unfulfilled += area_total
                                    # Check for driver requirements
                                    if isinstance(requirements, dict) and 'Driver' in requirements:
                                        driver_unfulfilled += requirements['Driver']
                                    
                                    if area_total > 0:
                                        self.stdout.write(f"    {area_name}:")
                                        for rank, count in requirements.items():
                                            if count > 0:
                                                self.stdout.write(f"      {rank}: {count}")
                        
                        self.stdout.write(f"  Total unfulfilled positions: {total_unfulfilled}")
                        if driver_unfulfilled > 0:
                            self.stdout.write(f"  Unfulfilled driver positions: {driver_unfulfilled}")
                    else:
                        self.stdout.write("  No unfulfilled requirements.")
                    
                    # Only consider field officers (not static, not fixed) as potential available officers
                    all_field_officers = set(field_policemen.values_list('id', flat=True))
                    assigned_officers = set([a.policeman.id for a in assignments if a.policeman])
                    unassigned_field_officers = all_field_officers - assigned_officers
                    
                    self.stdout.write(f"  Field officers not assigned in this roster: {len(unassigned_field_officers)}")
                    
                    # Driver availability analysis
                    field_driver_ids = set(field_drivers.values_list('id', flat=True))
                    assigned_driver_ids = set([a.policeman.id for a in driver_assignments if a.policeman])
                    unassigned_drivers = field_driver_ids - assigned_driver_ids
                    self.stdout.write(f"  Field drivers not assigned: {len(unassigned_drivers)}")
                    
                    # Analyze why there might be shortages considering only field officers
                    if unfulfilled and unassigned_field_officers:
                        self.stdout.write("\n  SHORTAGE ANALYSIS (Field Officers Only):")
                        # Check for available officers by rank
                        unused_by_rank = defaultdict(list)
                        for officer_id in unassigned_field_officers:
                            try:
                                officer = Policeman.objects.get(id=officer_id)
                                unused_by_rank[officer.rank].append(officer)
                            except Policeman.DoesNotExist:
                                continue
                        
                        # Display available unused officers by rank
                        self.stdout.write("  Available unused field officers by rank:")
                        for rank, officers in unused_by_rank.items():
                            rank_name = dict(Policeman.RANK_CHOICES).get(rank, rank)
                            self.stdout.write(f"    {rank_name}: {len(officers)}")
                            
                            # Check limitations
                            driver_count = sum(1 for o in officers if o.is_driver)
                            if driver_count > 0:
                                self.stdout.write(f"      - {driver_count} are drivers")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error analyzing roster {roster.id}: {str(e)}"))
                    self.stdout.write(traceback.format_exc())
            
            # Latest roster summary - use specified roster if provided, otherwise use the latest active one
            current_roster = None
            if roster_id:
                try:
                    current_roster = Roster.objects.get(id=roster_id)
                except Roster.DoesNotExist:
                    pass
            elif rosters.exists():
                current_roster = rosters.first()
            
            if current_roster:
                try:
                    self.stdout.write("\n" + self.style.SUCCESS(f"=== ROSTER SUMMARY (#{current_roster.id}) ==="))
                    assignments = RosterAssignment.objects.filter(roster=current_roster)
                    
                    # Check if all field officers are utilized
                    total_field_officers = field_policemen.count()
                    assigned_field_officers = assignments.filter(
                        policeman__isnull=False,
                        policeman__preferred_duty='FIELD',
                        policeman__has_fixed_duty=False
                    ).values('policeman').distinct().count()
                    
                    self.stdout.write(f"Total field officers (not fixed): {total_field_officers}")
                    self.stdout.write(f"Field officers assigned to this roster: {assigned_field_officers}")
                    self.stdout.write(f"Field utilization rate: {assigned_field_officers/total_field_officers*100:.2f}% (should be high)")
                    
                    # Driver utilization
                    assigned_drivers = assignments.filter(policeman__is_driver=True).count()
                    field_available_drivers = field_drivers.count()
                    self.stdout.write(f"\nDriver utilization:")
                    self.stdout.write(f"  Field drivers available: {field_available_drivers}")
                    self.stdout.write(f"  Drivers assigned: {assigned_drivers}")
                    if field_available_drivers > 0:
                        driver_utilization = (assigned_drivers / field_available_drivers) * 100
                        self.stdout.write(f"  Driver utilization rate: {driver_utilization:.2f}%")
                    
                    # Calculate unfulfilled by rank
                    unfulfilled_by_rank = defaultdict(int)
                    unfulfilled = current_roster.unfulfilled_requirements
                    
                    # Look specifically for driver shortages
                    driver_shortage = 0
                    
                    # New format from generate_roster.py - check for 'areas' and 'totals' keys
                    if isinstance(unfulfilled, dict) and 'areas' in unfulfilled and 'totals' in unfulfilled:
                        # Use the totals field for quick rank summary
                        totals = unfulfilled.get('totals', [])
                        for req in totals:
                            rank = req.get('display', req.get('rank', 'Unknown'))
                            count = req.get('count', 0)
                            unfulfilled_by_rank[rank] += count
                            if rank == 'Driver':
                                driver_shortage += count
                    # Old format - check both dict and list structures
                    elif isinstance(unfulfilled, dict):
                        for area_reqs in unfulfilled.values():
                            if isinstance(area_reqs, dict):
                                for req_rank, count in area_reqs.items():
                                    unfulfilled_by_rank[req_rank] += count
                                    if req_rank == 'Driver':
                                        driver_shortage += count
                    elif isinstance(unfulfilled, list):
                        for item in unfulfilled:
                            if isinstance(item, dict) and 'requirements' in item:
                                requirements = item['requirements']
                                if isinstance(requirements, dict):
                                    for req_rank, count in requirements.items():
                                        unfulfilled_by_rank[req_rank] += count
                                        if req_rank == 'Driver':
                                            driver_shortage += count
                    
                    if driver_shortage > 0:
                        self.stdout.write(f"  Driver shortage: {driver_shortage}")
                        # Check if we have enough drivers overall
                        available_unassigned_drivers = field_drivers.count() - assigned_drivers
                        if available_unassigned_drivers > 0:
                            self.stdout.write(f"  NOTE: {available_unassigned_drivers} drivers are available but not assigned")
                            # Which ranks are these drivers?
                            unassigned_drivers_ids = set(field_drivers.values_list('id', flat=True)) - set(assignments.filter(policeman__is_driver=True).values_list('policeman__id', flat=True))
                            unassigned_drivers = Policeman.objects.filter(id__in=unassigned_drivers_ids)
                            self.stdout.write("  Unassigned drivers by rank:")
                            for rank, name in Policeman.RANK_CHOICES:
                                rank_count = unassigned_drivers.filter(rank=rank).count()
                                if rank_count > 0:
                                    self.stdout.write(f"    {name}: {rank_count}")
                    
                    # Compare requirements vs. available FIELD officers
                    self.stdout.write("\nAvailability vs Requirements by Rank (FIELD OFFICERS ONLY):")
                    all_ranks = dict(Policeman.RANK_CHOICES)
                    for rank_code, rank_name in all_ranks.items():
                        # Only count field officers without fixed duties
                        available = field_policemen.filter(rank=rank_code).count()
                        assigned = assignments.filter(
                            policeman__rank=rank_code,
                            policeman__preferred_duty='FIELD',
                            policeman__has_fixed_duty=False
                        ).count()
                        
                        # Get unfulfilled for this rank
                        unfulfilled_count = unfulfilled_by_rank.get(rank_name, 0)
                        
                        required = assigned + unfulfilled_count
                        self.stdout.write(f"  {rank_name}: {available} available, {assigned} assigned, {unfulfilled_count} unfulfilled, {required} required")
                        if required > available:
                            self.stdout.write(f"    SHORTAGE: Need {required-available} more {rank_name} for field duty")
                        elif available > assigned:
                            self.stdout.write(f"    UNDERUTILIZED: {available-assigned} {rank_name} not assigned")
                    
                    # HOME GUARD ANALYSIS
                    self.stdout.write("\n" + self.style.SUCCESS("=== HOME GUARD ANALYSIS ==="))
                    
                    # Identify Home Guard rank code
                    home_guard_rank = None
                    for rank_code, rank_name in Policeman.RANK_CHOICES:
                        if rank_name == 'Home Guard':
                            home_guard_rank = rank_code
                            break
                    
                    if not home_guard_rank:
                        self.stdout.write(self.style.ERROR("Home Guard rank not found in RANK_CHOICES"))
                    else:
                        # Total Home Guards
                        total_home_guards = Policeman.objects.filter(rank=home_guard_rank).count()
                        self.stdout.write(f"Total Home Guards: {total_home_guards}")
                        
                        # Home Guards available for field duty
                        field_home_guards = field_policemen.filter(rank=home_guard_rank).count()
                        self.stdout.write(f"Home Guards available for field duty: {field_home_guards}")
                        
                        # Home Guards with fixed duty
                        fixed_home_guards = Policeman.objects.filter(rank=home_guard_rank, has_fixed_duty=True).count()
                        self.stdout.write(f"Home Guards with fixed duties: {fixed_home_guards}")
                        
                        # Home Guards with static duty
                        static_home_guards = Policeman.objects.filter(rank=home_guard_rank, preferred_duty='STATIC').count()
                        self.stdout.write(f"Home Guards with static duty preference: {static_home_guards}")
                        
                        # Assigned Home Guards in this roster
                        assigned_home_guards = assignments.filter(
                            policeman__rank=home_guard_rank
                        ).count()
                        self.stdout.write(f"Home Guards assigned in this roster: {assigned_home_guards}")
                        
                        # Home Guard deployment requirements
                        home_guard_requirements = assigned_home_guards
                        home_guard_unfulfilled = unfulfilled_by_rank.get('Home Guard', 0)
                        total_home_guard_required = home_guard_requirements + home_guard_unfulfilled
                        self.stdout.write(f"Total Home Guard deployment requirements: {total_home_guard_required}")
                        self.stdout.write(f"Unfulfilled Home Guard requirements: {home_guard_unfulfilled}")
                        
                        # Analysis of shortage
                        self.stdout.write("\nShortage Analysis:")
                        if home_guard_unfulfilled > 0:
                            if total_home_guards < total_home_guard_required:
                                shortage_amount = total_home_guard_required - total_home_guards
                                self.stdout.write(f"PERSONNEL SHORTAGE: Total Home Guards ({total_home_guards}) is less than required ({total_home_guard_required}) by {shortage_amount}")
                            
                            if field_home_guards < total_home_guard_required:
                                field_shortage = total_home_guard_required - field_home_guards
                                self.stdout.write(f"FIELD DUTY SHORTAGE: Available field Home Guards ({field_home_guards}) is less than required ({total_home_guard_required}) by {field_shortage}")
                                
                                if fixed_home_guards > 0:
                                    self.stdout.write(f"  - {fixed_home_guards} Home Guards are on fixed duties and unavailable for field deployment")
                                
                                if static_home_guards > 0:
                                    self.stdout.write(f"  - {static_home_guards} Home Guards have static duty preference and may not be suitable for field deployment")
                            
                            # Check for unassigned Home Guards
                            unassigned_home_guards = field_home_guards - assigned_home_guards
                            if unassigned_home_guards > 0:
                                self.stdout.write(f"NOTE: {unassigned_home_guards} field Home Guards are available but not assigned")
                                self.stdout.write("  Possible reasons:")
                                self.stdout.write("  - Area constraints or schedule conflicts")
                                self.stdout.write("  - Assignment algorithm limitations")
                                self.stdout.write("  - Special skills requirements not being met")
                                
                                # South-west area analysis for Home Guards
                                south_west_areas = Area.objects.filter(zone__name__icontains='South-west')
                                if south_west_areas.exists():
                                    self.stdout.write("\n  South-west Area Analysis:")
                                    for area in south_west_areas:
                                        area_assignments = assignments.filter(area=area, policeman__rank=home_guard_rank).count()
                                        self.stdout.write(f"    {area.name}: {area_assignments} Home Guards assigned")
                                
                                    self.stdout.write("  Possible South-west Area Constraints:")
                                    self.stdout.write("  - Geographic distance limitations")
                                    self.stdout.write("  - Special area requirements that available Home Guards don't meet")
                                    self.stdout.write("  - Time/shift constraints for available Home Guards")
                        else:
                            self.stdout.write("No unfulfilled Home Guard requirements detected.")
                    
                    # CONSTABLE ANALYSIS
                    self.stdout.write("\n" + self.style.SUCCESS("=== CONSTABLE ANALYSIS ==="))
                    
                    # Identify Constable rank code
                    constable_rank = None
                    for rank_code, rank_name in Policeman.RANK_CHOICES:
                        if rank_name == 'Constable':
                            constable_rank = rank_code
                            break
                    
                    if not constable_rank:
                        self.stdout.write(self.style.ERROR("Constable rank not found in RANK_CHOICES"))
                    else:
                        # Total Constables
                        total_constables = Policeman.objects.filter(rank=constable_rank).count()
                        self.stdout.write(f"Total Constables: {total_constables}")
                        
                        # Constables available for field duty
                        field_constables = field_policemen.filter(rank=constable_rank).count()
                        self.stdout.write(f"Constables available for field duty: {field_constables}")
                        
                        # Constables with fixed duty
                        fixed_constables = Policeman.objects.filter(rank=constable_rank, has_fixed_duty=True).count()
                        self.stdout.write(f"Constables with fixed duties: {fixed_constables}")
                        
                        # Constables with static duty
                        static_constables = Policeman.objects.filter(rank=constable_rank, preferred_duty='STATIC').count()
                        self.stdout.write(f"Constables with static duty preference: {static_constables}")
                        
                        # Drivers who are constables
                        driver_constables = Policeman.objects.filter(rank=constable_rank, is_driver=True).count()
                        self.stdout.write(f"Constables who are drivers: {driver_constables}")
                        
                        # Assigned Constables in this roster
                        assigned_constables = assignments.filter(
                            policeman__rank=constable_rank
                        ).count()
                        self.stdout.write(f"Constables assigned in this roster: {assigned_constables}")
                        
                        # Constable deployment requirements
                        constable_requirements = assigned_constables
                        constable_unfulfilled = unfulfilled_by_rank.get('Constable', 0)
                        total_constable_required = constable_requirements + constable_unfulfilled
                        self.stdout.write(f"Total Constable deployment requirements: {total_constable_required}")
                        self.stdout.write(f"Unfulfilled Constable requirements: {constable_unfulfilled}")
                        
                        # Analysis of shortage
                        self.stdout.write("\nShortage Analysis:")
                        if constable_unfulfilled > 0:
                            if total_constables < total_constable_required:
                                shortage_amount = total_constable_required - total_constables
                                self.stdout.write(f"PERSONNEL SHORTAGE: Total Constables ({total_constables}) is less than required ({total_constable_required}) by {shortage_amount}")
                            
                            if field_constables < total_constable_required:
                                field_shortage = total_constable_required - field_constables
                                self.stdout.write(f"FIELD DUTY SHORTAGE: Available field Constables ({field_constables}) is less than required ({total_constable_required}) by {field_shortage}")
                                
                                if fixed_constables > 0:
                                    self.stdout.write(f"  - {fixed_constables} Constables are on fixed duties and unavailable for field deployment")
                                
                                if static_constables > 0:
                                    self.stdout.write(f"  - {static_constables} Constables have static duty preference and may not be suitable for field deployment")
                                
                                if driver_constables > 0:
                                    self.stdout.write(f"  - {driver_constables} Constables are drivers (may have special deployment constraints)")
                            
                            # Check for areas with Constable shortages
                            constable_shortage_areas = []
                            
                            if isinstance(unfulfilled, dict) and 'areas' in unfulfilled:
                                areas = unfulfilled.get('areas', [])
                                for area_data in areas:
                                    area_name = area_data.get('area_name', 'Unknown Area')
                                    zone_name = area_data.get('zone_name', '')
                                    unfulfilled_items = area_data.get('unfulfilled', [])
                                    
                                    for req in unfulfilled_items:
                                        rank = req.get('display', req.get('rank', 'Unknown'))
                                        count = req.get('count', 0)
                                        
                                        if rank == 'Constable' and count > 0:
                                            full_area_name = f"{area_name} ({zone_name})" if zone_name else area_name
                                            constable_shortage_areas.append((full_area_name, count))
                            
                            if constable_shortage_areas:
                                self.stdout.write("\nAreas with Constable shortages:")
                                for area_name, count in constable_shortage_areas:
                                    self.stdout.write(f"  - {area_name}: {count} Constables needed")
                                
                                # Check for any patterns in shortage areas
                                south_west_shortage = sum(count for area, count in constable_shortage_areas if 'South-west' in area)
                                if south_west_shortage > 0:
                                    self.stdout.write(f"\n  South-west zone has the highest concentration of shortages ({south_west_shortage} Constables)")
                                    self.stdout.write("  Possible causes:")
                                    self.stdout.write("  - Geographic constraints for available Constables")
                                    self.stdout.write("  - Special skills requirements in South-west areas")
                                    self.stdout.write("  - Assignment algorithm prioritizing other critical areas first")
                        else:
                            self.stdout.write("No unfulfilled Constable requirements detected.")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error analyzing roster: {str(e)}"))
                    self.stdout.write(traceback.format_exc())
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error in command: {str(e)}"))
            self.stdout.write(traceback.format_exc()) 
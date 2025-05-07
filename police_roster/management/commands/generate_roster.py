from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone
import random
from collections import defaultdict

from police_roster.models import (
    Zone, Area, Policeman, Deployment, 
    Roster, RosterAssignment, PreviousRoster, CorrigendumChange
)


class RosterGenerator:
    """Helper class for roster generation logic"""
    
    # Restricted areas for female employees
    RESTRICTED_AREAS = {
        'Zebra-101', 'Zebra-102', 'Zebra-103', 'Zebra-104', 'Zebra-105', 'Zebra-106', 
        'Zebra-107', 'Zebra-108', 'Zebra-109', 'Zebra-111', 'Zebra-112', 'Zebra-201', 
        'Zebra-202', 'Zebra-203', 'Zebra-204', 'Zebra-205', 'Zebra-207', 'Zebra-208', 
        'Zebra-210', 'Zebra-211', 'Zebra-212', 'Zebra-213', 'Zebra-301', 'Zebra-303', 
        'Zebra-304', 'Zebra-306', 'Zebra-308', 'Zebra-309', 'Zeb-310', 'Zeb-311', 
        'Zebra-401', 'Zebra-403', 'Zebra-404', 'Zebra-406', 'Zebra-407', 'Zebra-408', 
        'Zebra-409', 'Zebra-410', 'Zullu-01', 'Zullu-02', 'Eagle-05 M/C', 'Eagle-01', 
        'Eagle-02', 'Eagle-03', 'Eagle-04', 'Eagle-05', 'Eagle-06', 'Eagle-07', 'Eagle-08', 
        'Eagle-09', 'Eagle-10', 'Eagle-11', 'Eagle-12', 'Towing-01', 'Towing-02', 
        'Towing-03', 'Towing-04', 'Rec-01', 'Rec-02', 'Rec-03', 'Rec-04', 'Recovery -05', 
        'Rhino-01', 'Rhino-02'
    }
    
    def __init__(self, verbose=False):
        self.repetition_count = 0
        self.same_area_repetition_count = 0
        self.previous_assignments = {}  # Dict to track {officer_id: (zone_id, area_id)} from previous roster
        self.assigned_officers = set()  # Track officers already assigned in current roster
        self.incomplete_assignments = []  # Track areas with unfulfilled requirements
        self.reserved_officers = []  # Track officers not assigned in current roster (reserved)
        self.verbose = verbose
        self.zone_shortages = defaultdict(int)  # Track shortages by zone to distribute them evenly
    
    def load_previous_assignments(self):
        """Load most recent previous assignments and corrigendum changes"""
        previous_roster = PreviousRoster.objects.all().order_by('-created_at').first()
        
        if not previous_roster:
            if self.verbose:
                print("No previous roster found")
            return
            
        try:
            # First load the regular assignments from roster_data
            if previous_roster.roster_data and isinstance(previous_roster.roster_data, dict):
                assignments = previous_roster.roster_data.get('assignments', [])
                if isinstance(assignments, list):
                    if self.verbose:
                        print(f"Found {len(assignments)} assignments in previous roster {previous_roster.id}")
                    for assignment in assignments:
                        self._process_previous_assignment(assignment)
                    if self.verbose:
                        print(f"Processed {len(self.previous_assignments)} previous assignments")
                else:
                    if self.verbose:
                        print("Previous roster assignments is not a list")
            else:
                if self.verbose:
                    print("Previous roster has no valid roster_data")

            # Then load and apply corrigendum changes to override previous assignments
            corrigendum_changes = CorrigendumChange.objects.filter(
                roster=previous_roster
            ).select_related('policeman', 'area', 'area__zone').order_by('-created_at')

            if self.verbose:
                print(f"Found {corrigendum_changes.count()} corrigendum changes")

            # Apply corrigendum changes - these override the original assignments
            for change in corrigendum_changes:
                self.previous_assignments[change.policeman.id] = (
                    change.area.zone_id,
                    change.area.id
                )
                if self.verbose:
                    print(f"Applied corrigendum change: Officer {change.policeman.name} -> Area {change.area.name}")

        except Exception as e:
            if self.verbose:
                print(f"Error loading previous assignments and changes: {e}")
                import traceback
                print(traceback.format_exc())
    
    def _process_previous_assignment(self, assignment):
        """Process a single previous assignment"""
        try:
            if ('area' in assignment and 'policeman' in assignment and 
                isinstance(assignment['area'], int) and 
                isinstance(assignment['policeman'], int)):
                
                area_id = assignment['area']
                try:
                    area = Area.objects.get(id=area_id)
                    self.previous_assignments[assignment['policeman']] = (
                        area.zone_id,
                        area_id
                    )
                    if self.verbose:
                        print(f"Added previous assignment: Officer {assignment['policeman']} -> Area {area_id} (Zone {area.zone_id})")
                except Area.DoesNotExist:
                    if self.verbose:
                        print(f"Area {area_id} not found")
                    pass
        except (TypeError, ValueError, KeyError) as e:
            if self.verbose:
                print(f"Error processing assignment: {e}")
            pass
    
    def generate_roster(self, name=None, pending=True):
        """Generate a new roster based on deployments and previous assignments"""
        # Reset tracking variables
        self.assigned_officers = set()
        self.incomplete_assignments = []
        self.repetition_count = 0
        self.same_area_repetition_count = 0
        self.zone_shortages = defaultdict(int)
        self.reserved_officers = []
        
        # Load previous assignments to avoid repetition
        self.load_previous_assignments()
        
        # Create a new roster
        roster_name = name or f"Roster {timezone.now().strftime('%Y-%m-%d')}"
        roster = Roster.objects.create(
            name=roster_name, 
            is_active=not pending,
            is_pending=pending
        )
        
        # Get all areas with their latest deployments
        areas_with_deployments = self._get_areas_with_deployments()
        
        # Calculate total requirements 
        total_requirements = {
            'SI': 0,
            'ASI': 0,
            'HC': 0,
            'CONST': 0,
            'HG': 0,
            'DRIVER': 0,
            'SENIOR': 0
        }
        
        for area, deployment in areas_with_deployments:
            total_requirements['SI'] += deployment.si_count
            total_requirements['ASI'] += deployment.asi_count
            total_requirements['HC'] += deployment.hc_count
            total_requirements['CONST'] += deployment.constable_count
            total_requirements['HG'] += deployment.hgv_count
            total_requirements['DRIVER'] += deployment.driver_count
            total_requirements['SENIOR'] += deployment.senior_count
            
        if self.verbose:
            print("\n=== TOTAL DEPLOYMENT REQUIREMENTS ===")
            for rank, count in total_requirements.items():
                print(f"{rank}: {count}")
            print("=====================================\n")
        
        # Get all field officers
        available_officers = self._get_available_officers()
        
        # Group officers by rank
        officers_by_rank = self._group_officers_by_rank(available_officers)
        
        # Print available officers by rank for debugging
        if self.verbose:
            print("\n=== AVAILABLE OFFICERS BY RANK ===")
            for rank, officers in officers_by_rank.items():
                print(f"{rank}: {len(officers)}")
            print("==================================\n")
        
        # Get drivers separately - ensure they are FIELD duty drivers only
        drivers = list(filter(lambda o: o.is_driver and o.preferred_duty == 'FIELD' and not o.has_fixed_duty, available_officers))
        
        if self.verbose:
            print(f"DEBUG: Found {len(drivers)} field-duty drivers available for assignment")

        # Track assignment counts
        rank_assignments = {
            'SI': 0,
            'ASI': 0,
            'HC': 0,
            'CONST': 0,
            'HG': 0,
            'DRIVER': 0,
            'SENIOR': 0
        }

        # FIRST: Handle SI assignments separately
        si_assignments = []
        if 'SI' in officers_by_rank:
            available_sis = officers_by_rank['SI']
            if self.verbose:
                print(f"\nDEBUG: Starting SI assignments with {len(available_sis)} available SIs")
            
            # Get areas needing SIs
            areas_needing_sis = [(area, deployment) for area, deployment in areas_with_deployments if deployment.si_count > 0]
            
            # Sort by SI requirement count (highest first)
            areas_needing_sis.sort(key=lambda x: x[1].si_count, reverse=True)
            
            if self.verbose:
                print(f"DEBUG: Found {len(areas_needing_sis)} areas needing SIs")
            
            # Process SI assignments
            for area, deployment in areas_needing_sis:
                if deployment.si_count > 0 and available_sis:
                    # Get available SIs for this area (considering restrictions)
                    available_sis_for_area = available_sis
                    if self._is_restricted_area(area):
                        available_sis_for_area = [si for si in available_sis if not self._is_female_officer(si)]
                    
                    if available_sis_for_area:
                        si_assignments_for_area = self._allocate_officers('SI', available_sis_for_area, deployment.si_count, area)
                        si_assignments.extend([(area, assignment) for assignment in si_assignments_for_area])
                        
                        # Update available SIs and track assignments
                        assigned_si_ids = {assignment['officer'].id for assignment in si_assignments_for_area}
                        available_sis = [si for si in available_sis if si.id not in assigned_si_ids]
                        rank_assignments['SI'] += len(si_assignments_for_area)
                        
                        if self.verbose:
                            print(f"DEBUG: Assigned {len(si_assignments_for_area)} SIs to {area.name}")
                            if len(si_assignments_for_area) < deployment.si_count:
                                print(f"WARNING: Could not fulfill all SI requirements for {area.name}. Needed {deployment.si_count}, assigned {len(si_assignments_for_area)}")
                                # Track unfulfilled SI requirements
                                unfulfilled = deployment.si_count - len(si_assignments_for_area)
                                self._add_unfulfilled_requirement(area, 'SI', unfulfilled)
                    else:
                        if self.verbose:
                            print(f"WARNING: No suitable SIs available for {area.name}")
                        self._add_unfulfilled_requirement(area, 'SI', deployment.si_count)
            
            # Create roster assignments for SIs
            for area, assignment in si_assignments:
                RosterAssignment.objects.create(
                    roster=roster,
                    area=area,
                    policeman=assignment['officer'],
                    was_previous_zone=assignment['was_previous_zone'],
                    was_previous_area=assignment['was_previous_area']
                )
            
            if self.verbose:
                print(f"\nDEBUG: Completed SI assignments. Total SI assignments: {len(si_assignments)}")
                print(f"DEBUG: Remaining available SIs: {len(available_sis)}")
                print(f"DEBUG: SI requirements fulfilled: {rank_assignments['SI']} of {total_requirements['SI']}")
                
                # Verify SI assignments
                assigned_si_count = RosterAssignment.objects.filter(
                    roster=roster,
                    policeman__rank='SI'
                ).count()
                print(f"DEBUG: Verified SI assignments in database: {assigned_si_count}")

        # SECOND: Create senior officers pool with remaining SIs
        senior_officers = []
        # Add remaining SIs first
        if 'SI' in officers_by_rank:
            senior_officers.extend([si for si in officers_by_rank['SI'] if si.id not in self.assigned_officers])
        # Then add ASIs and HCs
        for rank in ['ASI', 'HC']:
            if rank in officers_by_rank:
                senior_officers.extend(officers_by_rank[rank])
        
        if self.verbose:
            print(f"\nDEBUG: Created senior officers pool with {len(senior_officers)} officers")
            print(f"DEBUG: Including {len([o for o in senior_officers if o.rank == 'SI'])} remaining SIs")
        
        # Shuffle all officer lists for randomness
        for rank in officers_by_rank:
            random.shuffle(officers_by_rank[rank])
        random.shuffle(drivers)
        random.shuffle(senior_officers)
        
        # Group areas by zone for balanced shortage distribution
        areas_by_zone = self._group_areas_by_zone(areas_with_deployments)
        
        # First pass: Calculate total senior requirements by zone for distribution
        zone_senior_requirements = self._calculate_zone_senior_requirements(areas_with_deployments)
        
        # Sort zones by total senior requirements to balance distribution
        sorted_zones = sorted(
            zone_senior_requirements.keys(),
            key=lambda z: zone_senior_requirements[z],
            reverse=True  # Zones with higher requirements get priority
        )
        
        # Process areas with senior requirements first, balancing across zones
        senior_assignments = []
        for zone_id in sorted_zones:
            if zone_id not in areas_by_zone:
                continue
                
            # Process each area in this zone
            for area, deployment in areas_by_zone[zone_id]:
                if deployment.senior_count > 0:
                    # Allocate senior officers to this area
                    area_senior_assignments = self._allocate_senior_officers(
                        senior_officers, deployment.senior_count, area
                    )
                    senior_assignments.extend([(area, assignment) for assignment in area_senior_assignments])
                    
                    # Track senior assignments
                    rank_assignments['SENIOR'] += len(area_senior_assignments)
                    
                    # Handle unfulfilled senior requirements
                    if len(area_senior_assignments) < deployment.senior_count:
                        unfulfilled = deployment.senior_count - len(area_senior_assignments)
                        self.zone_shortages[zone_id] += unfulfilled
                        self._add_unfulfilled_requirement(area, 'SENIOR', unfulfilled)
        
        # Create roster assignments for senior officers
        for area, assignment in senior_assignments:
            RosterAssignment.objects.create(
                roster=roster,
                area=area,
                policeman=assignment['officer'],
                was_previous_zone=assignment['was_previous_zone'],
                was_previous_area=assignment['was_previous_area']
            )
            
            # Track officer rank for statistics
            officer_rank = assignment['officer'].rank
            if officer_rank in rank_assignments:
                rank_assignments[officer_rank] += 1
        
        if self.verbose:
            print("\n=== ASSIGNMENT SUMMARY ===")
            print(f"SI Assignments: {len(si_assignments)}")
            print(f"Senior Assignments: {len(senior_assignments)}")
            print("=========================\n")
        
        # Now process regular assignments for all areas
        # Sort areas by zones with higher shortage ratio for better distribution
        sorted_areas_with_deployments = self._sort_areas_for_balanced_shortage(areas_with_deployments)
        
        # First Pass: Calculate total driver requirements by priority
        # Sort areas by driver requirement first, this ensures we allocate drivers to where they're needed most
        areas_needing_drivers = [(area, deployment) for area, deployment in sorted_areas_with_deployments if deployment.driver_count > 0]
        areas_needing_drivers.sort(key=lambda x: x[1].driver_count, reverse=True)
        
        total_driver_requirement = sum(deployment.driver_count for area, deployment in areas_with_deployments)
        if self.verbose:
            print(f"DEBUG: Total driver requirement across all areas: {total_driver_requirement}")
            print(f"DEBUG: Total available drivers: {len(drivers)}")
            print(f"DEBUG: Areas needing drivers: {len(areas_needing_drivers)}")
        
        # Process each area and create assignments, but first allocate areas needing drivers
        for area, deployment in areas_needing_drivers:
            area_assignments = self._process_area_assignment(area, deployment, officers_by_rank, drivers, roster)
            
            # Update rank assignment counts
            for assignment in area_assignments:
                officer = assignment.policeman
                if officer.is_driver:
                    rank_assignments['DRIVER'] += 1
                if officer.rank in rank_assignments:
                    rank_assignments[officer.rank] += 1
        
        # Second pass: Process remaining areas without driver requirements
        areas_without_drivers = [(area, deployment) for area, deployment in sorted_areas_with_deployments if deployment.driver_count == 0]
        for area, deployment in areas_without_drivers:
            area_assignments = self._process_area_assignment(area, deployment, officers_by_rank, drivers, roster)
            
            # Update rank assignment counts
            for assignment in area_assignments:
                officer = assignment.policeman
                if officer.is_driver:
                    rank_assignments['DRIVER'] += 1
                if officer.rank in rank_assignments:
                    rank_assignments[officer.rank] += 1
        
        # Check for any unfulfilled requirements - if we still have drivers, use them in their ranks
        remaining_drivers = [d for d in drivers if d.id not in self.assigned_officers]
        if remaining_drivers and self.incomplete_assignments:
            if self.verbose:
                print(f"DEBUG: We have {len(remaining_drivers)} drivers left. Checking if they can fill other positions.")
            
            for item in list(self.incomplete_assignments):  # Use a copy to safely modify during iteration
                area = item['area']
                unfulfilled = item['unfulfilled']
                
                # First try to fill driver requirements if any are still unfulfilled
                if 'DRIVER' in unfulfilled and unfulfilled['DRIVER'] > 0:
                    drivers_needed = unfulfilled['DRIVER']
                    drivers_to_assign = min(len(remaining_drivers), drivers_needed)
                    
                    if drivers_to_assign > 0:
                        if self.verbose:
                            print(f"DEBUG: Filling {drivers_to_assign} driver positions in {area.name}")
                        
                        for i in range(drivers_to_assign):
                            driver = remaining_drivers.pop(0)
                            
                            # Skip if restricted area and female driver
                            if self._is_restricted_area(area) and self._is_female_officer(driver):
                                continue
                                
                            # Check if this would cause repetition
                            was_previous_zone, was_previous_area = self._check_previous_assignment(driver, area)
                            
                            RosterAssignment.objects.create(
                                roster=roster,
                                area=area,
                                policeman=driver,
                                was_previous_zone=was_previous_zone,
                                was_previous_area=was_previous_area
                            )
                            
                            # Update tracking
                            self.assigned_officers.add(driver.id)
                            if was_previous_zone:
                                self.repetition_count += 1
                            if was_previous_area:
                                self.same_area_repetition_count += 1
                            
                            # Update unfulfilled count
                            unfulfilled['DRIVER'] -= 1
                            if unfulfilled['DRIVER'] == 0:
                                del unfulfilled['DRIVER']
                            
                            rank_assignments['DRIVER'] += 1
                
                # Then try to fill other ranks with remaining drivers
                if remaining_drivers:
                    for rank in list(unfulfilled.keys()):  # Use list() to safely modify during iteration
                        if rank != 'DRIVER' and unfulfilled[rank] > 0:
                            # Find drivers with matching rank
                            matching_drivers = [d for d in remaining_drivers if d.rank == rank]
                            
                            if matching_drivers:
                                drivers_to_assign = min(len(matching_drivers), unfulfilled[rank])
                                
                                if self.verbose:
                                    print(f"DEBUG: Filling {drivers_to_assign} {rank} positions with drivers in {area.name}")
                                
                                for i in range(drivers_to_assign):
                                    driver = matching_drivers[i]
                                    remaining_drivers.remove(driver)
                                    
                                    # Skip if restricted area and female driver
                                    if self._is_restricted_area(area) and self._is_female_officer(driver):
                                        continue
                                        
                                    # Check if this would cause repetition
                                    was_previous_zone, was_previous_area = self._check_previous_assignment(driver, area)
                                    
                                    RosterAssignment.objects.create(
                                        roster=roster,
                                        area=area,
                                        policeman=driver,
                                        was_previous_zone=was_previous_zone,
                                        was_previous_area=was_previous_area
                                    )
                                    
                                    # Update tracking
                                    self.assigned_officers.add(driver.id)
                                    if was_previous_zone:
                                        self.repetition_count += 1
                                    if was_previous_area:
                                        self.same_area_repetition_count += 1
                                    
                                    # Update unfulfilled count
                                    unfulfilled[rank] -= 1
                                    if unfulfilled[rank] == 0:
                                        del unfulfilled[rank]
                                    
                                    # Update assignments count
                                    rank_assignments[rank] += 1
                
                # If all requirements for this area are now fulfilled, remove it from incomplete_assignments
                if not unfulfilled:
                    self.incomplete_assignments.remove(item)
        
        # Special pass for Home Guards - ensure all Home Guard positions are filled
        # They can be assigned anywhere without restriction (except gender restriction in restricted areas)
        areas_needing_homeguards = []
        for item in list(self.incomplete_assignments):
            if 'HG' in item['unfulfilled'] and item['unfulfilled']['HG'] > 0:
                areas_needing_homeguards.append(item)
        
        if areas_needing_homeguards:
            # Get all available Home Guards not yet assigned
            available_hgs = [o for o in officers_by_rank.get('HG', []) if o.id not in self.assigned_officers]
            
            if available_hgs and self.verbose:
                print(f"DEBUG: We have {len(available_hgs)} Home Guards left. Trying to fill {len(areas_needing_homeguards)} areas needing Home Guards.")
            
            # Sort Home Guards by least repetition risk
            for area_item in areas_needing_homeguards:
                area = area_item['area']
                hgs_needed = area_item['unfulfilled']['HG']
                
                # Check if area is restricted
                is_restricted = self._is_restricted_area(area)
                
                # Filter available Home Guards for this area
                hgs_for_area = available_hgs
                if is_restricted:
                    hgs_for_area = [hg for hg in hgs_for_area if not self._is_female_officer(hg)]
                
                # If we have any HGs for this area, try to assign them
                if hgs_for_area:
                    # First, sort by those with no previous assignment to this zone or area
                    hgs_by_priority = []
                    for hg in hgs_for_area:
                        was_previous_zone, was_previous_area = self._check_previous_assignment(hg, area)
                        hgs_by_priority.append((hg, was_previous_zone, was_previous_area))
                    
                    # Sort by least repetition
                    hgs_by_priority.sort(key=lambda x: (1 if x[1] else 0, 1 if x[2] else 0))
                    
                    # Assign as many as needed or available
                    hgs_to_assign = min(len(hgs_by_priority), hgs_needed)
                    
                    if self.verbose:
                        print(f"DEBUG: Filling {hgs_to_assign} Home Guard positions in {area.name}")
                    
                    for i in range(hgs_to_assign):
                        hg, was_previous_zone, was_previous_area = hgs_by_priority[i]
                        
                        RosterAssignment.objects.create(
                            roster=roster,
                            area=area,
                            policeman=hg,
                            was_previous_zone=was_previous_zone,
                            was_previous_area=was_previous_area
                        )
                        
                        # Update tracking
                        self.assigned_officers.add(hg.id)
                        available_hgs.remove(hg)
                        if was_previous_zone:
                            self.repetition_count += 1
                        if was_previous_area:
                            self.same_area_repetition_count += 1
                        
                        # Update unfulfilled count
                        area_item['unfulfilled']['HG'] -= 1
                        if area_item['unfulfilled']['HG'] == 0:
                            del area_item['unfulfilled']['HG']
                        
                        # Update assignments count
                        rank_assignments['HG'] += 1
                        
                    # If all requirements for this area are now fulfilled, remove it from incomplete_assignments
                    if not area_item['unfulfilled']:
                        self.incomplete_assignments.remove(area_item)
        
        # Print assignment statistics
        if self.verbose:
            print("\n=== ASSIGNMENT STATISTICS ===")
            for rank, count in rank_assignments.items():
                required = total_requirements.get(rank, 0)
                difference = count - required
                status = "SURPLUS" if difference >= 0 else "SHORTAGE"
                print(f"{rank}: {count} assigned of {required} required. {status}: {abs(difference)}")
            print("=============================\n")
        
        # Update roster with repetition counts and unfulfilled requirements
        roster.repetition_count = self.repetition_count
        roster.same_area_repetition_count = self.same_area_repetition_count
        
        # Store unfulfilled requirements
        if self.incomplete_assignments:
            roster.unfulfilled_requirements = self._format_unfulfilled_requirements()
        else:
            roster.unfulfilled_requirements = None
        
        # Find all unassigned (reserved) field officers
        all_field_officers = self._get_available_officers()
        self.reserved_officers = [officer for officer in all_field_officers if officer.id not in self.assigned_officers]
        
        # Format and store reserved officers in the roster
        if self.reserved_officers:
            reserved_by_rank = self._format_reserved_officers()
            if roster.unfulfilled_requirements:
                roster.unfulfilled_requirements['reserved'] = reserved_by_rank
            else:
                roster.unfulfilled_requirements = {'reserved': reserved_by_rank}
            
        roster.save()
        
        return roster
    
    def _get_areas_with_deployments(self):
        """Get all areas with their latest deployments"""
        areas_with_deployments = []
        for area in Area.objects.all():
            deployment = area.deployments.order_by('-created_at').first()
            if deployment:
                areas_with_deployments.append((area, deployment))
        return areas_with_deployments
    
    def _group_areas_by_zone(self, areas_with_deployments):
        """Group areas by zone for balanced processing"""
        areas_by_zone = defaultdict(list)
        for area, deployment in areas_with_deployments:
            areas_by_zone[area.zone_id].append((area, deployment))
        return areas_by_zone
    
    def _calculate_zone_senior_requirements(self, areas_with_deployments):
        """Calculate total senior requirements by zone"""
        zone_requirements = defaultdict(int)
        for area, deployment in areas_with_deployments:
            if deployment.senior_count > 0:
                zone_requirements[area.zone_id] += deployment.senior_count
        return zone_requirements
    
    def _sort_areas_for_balanced_shortage(self, areas_with_deployments):
        """Sort areas to balance shortages across zones"""
        # Calculate current shortage ratio by zone
        total_zone_requirements = defaultdict(int)
        for area, deployment in areas_with_deployments:
            total = (
                deployment.si_count + 
                deployment.asi_count + 
                deployment.hc_count + 
                deployment.constable_count
            )
            total_zone_requirements[area.zone_id] += total
        
        # Calculate shortage ratio
        zone_shortage_ratio = {}
        for zone_id, total_required in total_zone_requirements.items():
            if total_required > 0:
                shortage = self.zone_shortages.get(zone_id, 0)
                zone_shortage_ratio[zone_id] = shortage / total_required
            else:
                zone_shortage_ratio[zone_id] = 0
        
        # Sort areas so that zones with lower shortage ratio are processed first
        # This helps distribute shortages more evenly
        result = sorted(
            areas_with_deployments,
            key=lambda x: (zone_shortage_ratio.get(x[0].zone_id, 0), x[0].zone_id)
        )
        
        return result
    
    def _allocate_senior_officers(self, senior_officers_pool, count, area):
        """Allocate senior officers (SI, ASI, HC) to meet senior_count requirements"""
        assignments = []
        
        # Check if area has restricted call sign for female employees
        is_restricted = self._is_restricted_area(area)
        
        # Filter out officers already assigned to this roster
        available_officers = [o for o in senior_officers_pool if o.id not in self.assigned_officers]
        
        # Count available officers before gender filtering
        count_before = len(available_officers)
        
        # Filter out female officers if this is a restricted area
        if is_restricted:
            # Store female officers separately for debugging
            female_officers = [o for o in available_officers if self._is_female_officer(o)]
            if female_officers and (self.verbose or count > 0):
                print(f"RESTRICTED AREA: Filtering out {len(female_officers)} female senior officers from allocation pool for {area.name}")
                for female in female_officers[:5]:  # Show first 5 for brevity
                    print(f"  - Excluded female officer: {female.name} (rank: {female.rank}, gender: {female.gender})")
                if len(female_officers) > 5:
                    print(f"  - ... and {len(female_officers) - 5} more female officers excluded")
            
            available_officers = [o for o in available_officers if not self._is_female_officer(o)]
            
            # Print results of filtering
            if self.verbose or count > 0:
                print(f"RESTRICTED AREA: For {area.name}, reduced senior officer pool from {count_before} to {len(available_officers)} after filtering out females")
        
        # Categorize officers by previous assignment status
        no_repetition = []
        zone_repetition = []
        area_repetition = []
        
        for officer in available_officers:
            was_previous_zone, was_previous_area = self._check_previous_assignment(officer, area)
            
            if was_previous_area:
                area_repetition.append((officer, was_previous_zone, was_previous_area))
            elif was_previous_zone:
                zone_repetition.append((officer, was_previous_zone, was_previous_area))
            else:
                no_repetition.append((officer, was_previous_zone, was_previous_area))
        
        # Combine all categories in priority order
        prioritized_officers = no_repetition + zone_repetition + area_repetition
        
        # Assign officers according to priority and count needed
        to_assign = min(count, len(prioritized_officers))
        
        for i in range(to_assign):
            officer, was_previous_zone, was_previous_area = prioritized_officers[i]
            
            # Double-check we're not assigning a female to restricted area
            if is_restricted and self._is_female_officer(officer):
                print(f"ERROR PREVENTION: Attempted to assign female senior officer {officer.name} to restricted area {area.name}. Skipping.")
                continue
                
            assignments.append({
                'officer': officer,
                'was_previous_zone': was_previous_zone,
                'was_previous_area': was_previous_area
            })
            
            # Update tracking
            self.assigned_officers.add(officer.id)
            if was_previous_zone:
                self.repetition_count += 1
            if was_previous_area:
                self.same_area_repetition_count += 1
            
            # Also remove from original senior_officers_pool to avoid reassignment
            if officer in senior_officers_pool:
                senior_officers_pool.remove(officer)
        
        return assignments
    
    def _add_unfulfilled_requirement(self, area, requirement_type, count):
        """Add an unfulfilled requirement to the tracking list"""
        # Check if this area already has unfulfilled requirements
        area_found = False
        for item in self.incomplete_assignments:
            if item['area'].id == area.id:
                item['unfulfilled'][requirement_type] = count
                area_found = True
                break
        
        # If area not found, add a new entry
        if not area_found:
            self.incomplete_assignments.append({
                'area': area,
                'unfulfilled': {requirement_type: count}
            })
    
    def _get_available_officers(self):
        """Get all available field officers and Home Guards"""
        return list(Policeman.objects.filter(
            Q(preferred_duty='FIELD', has_fixed_duty=False)
            # Only include Home Guards who are field officers (not static)
            # We no longer include ALL Home Guards regardless of settings
        ))
    
    def _group_officers_by_rank(self, officers):
        """Group officers by rank"""
        officers_by_rank = defaultdict(list)
        for officer in officers:
            # Since we're only getting field officers in _get_available_officers,
            # we don't need special handling for Home Guards here
            officers_by_rank[officer.rank].append(officer)
        return officers_by_rank
    
    def _process_area_assignment(self, area, deployment, officers_by_rank, drivers, roster):
        """Process assignments for a single area"""
        area_assignments = []
        unfulfilled_requirements = {}
        created_assignments = []  # Track created assignments to return
        
        # Check if this is a restricted area
        is_restricted = self._is_restricted_area(area)
        if is_restricted:
            print(f"RESTRICTED AREA CHECK: {area.name} with call_sign '{area.call_sign}' - NO female officers allowed")
        
        # FIRST: Allocate drivers - prioritize driver allocation before anything else
        driver_assignments = self._allocate_drivers(drivers, deployment.driver_count, area)
        
        # Verify no female drivers were assigned to restricted areas
        if is_restricted:
            driver_assignments = [a for a in driver_assignments if not self._is_female_officer(a['officer'])]
        
        area_assignments.extend(driver_assignments)
        driver_count_assigned = len(driver_assignments)
        
        # Update assigned officers with the drivers we just assigned
        for assignment in driver_assignments:
            self.assigned_officers.add(assignment['officer'].id)
        
        if driver_count_assigned < deployment.driver_count:
            unfulfilled_requirements['DRIVER'] = deployment.driver_count - driver_count_assigned
            # Track shortage by zone for balanced distribution
            self.zone_shortages[area.zone_id] += (deployment.driver_count - driver_count_assigned)
        
        # NEXT: Allocate officers by rank
        ranks_to_allocate = {
            'SI': deployment.si_count,
            'ASI': deployment.asi_count,
            'HC': deployment.hc_count,
            'CONST': deployment.constable_count,
            'HG': deployment.hgv_count
        }
        
        for rank, count in ranks_to_allocate.items():
            assignments = self._allocate_officers(rank, officers_by_rank.get(rank, []), count, area)
            
            # Verify no female officers were assigned to restricted areas
            if is_restricted:
                assignments = [a for a in assignments if not self._is_female_officer(a['officer'])]
            
            area_assignments.extend(assignments)
            
            if len(assignments) < count:
                unfulfilled_requirements[rank] = count - len(assignments)
                # Track shortage by zone for balanced distribution
                self.zone_shortages[area.zone_id] += (count - len(assignments))
        
        # Track areas with unfulfilled requirements
        if unfulfilled_requirements:
            # Check if this area already has unfulfilled requirements
            area_found = False
            for item in self.incomplete_assignments:
                if item['area'].id == area.id:
                    item['unfulfilled'].update(unfulfilled_requirements)
                    area_found = True
                    break
            
            # If area not found, add a new entry
            if not area_found:
                self.incomplete_assignments.append({
                    'area': area,
                    'unfulfilled': unfulfilled_requirements
                })
        
        # Create roster assignments
        for assignment in area_assignments:
            # Final safety check for restricted areas
            if is_restricted and self._is_female_officer(assignment['officer']):
                print(f"SECURITY CHECK: Prevented female officer {assignment['officer'].name} from being assigned to restricted area {area.name}")
                continue
                
            roster_assignment = RosterAssignment.objects.create(
                roster=roster,
                area=area,
                policeman=assignment['officer'],
                was_previous_zone=assignment['was_previous_zone'],
                was_previous_area=assignment['was_previous_area']
            )
            created_assignments.append(roster_assignment)
        
        # Final verification for this area
        if is_restricted:
            roster_assignments = RosterAssignment.objects.filter(roster=roster, area=area)
            for assignment in roster_assignments:
                if self._is_female_officer(assignment.policeman):
                    print(f"FINAL VERIFICATION ERROR: Female officer {assignment.policeman.name} was assigned to restricted area {area.name}!")
                    # Remove the incorrect assignment
                    assignment.delete()
                    print(f"CORRECTION: Removed invalid assignment of {assignment.policeman.name} from restricted area {area.name}")
                    
                    # Also remove from our return list
                    created_assignments = [a for a in created_assignments if a.id != assignment.id]
                    
        return created_assignments
    
    def _allocate_drivers(self, drivers, count, area):
        """Allocate drivers to an area"""
        driver_assignments = []
        
        # Check if area has restricted call sign for female employees
        is_restricted = self._is_restricted_area(area)
        
        if count > 0:
            if self.verbose:
                print(f"DEBUG: Allocating {count} drivers to area {area.name} (restricted: {is_restricted})")
                print(f"DEBUG: Total driver pool: {len(drivers)}")
                
            # Only filter out officers that are already assigned, don't modify the original list
            available_drivers = [d for d in drivers if d.id not in self.assigned_officers]
            
            if self.verbose:
                print(f"DEBUG: Area {area.name} requires {count} drivers. {len(available_drivers)} drivers available.")
                
            # Count before gender filtering
            count_before = len(available_drivers)
            
            # Filter out female drivers if this is a restricted area
            if is_restricted:
                # Store female officers separately for debugging
                female_drivers = [d for d in available_drivers if self._is_female_officer(d)]
                if female_drivers and (self.verbose or count > 0):
                    print(f"RESTRICTED AREA: Filtering out {len(female_drivers)} female drivers from allocation pool for {area.name}")
                    for female in female_drivers[:5]:  # Show first 5 for brevity
                        print(f"  - Excluded female driver: {female.name} (gender: {female.gender})")
                    if len(female_drivers) > 5:
                        print(f"  - ... and {len(female_drivers) - 5} more female drivers excluded")
                
                available_drivers = [d for d in available_drivers if not self._is_female_officer(d)]
                
                # Print results of filtering
                if self.verbose or count > 0:
                    print(f"RESTRICTED AREA: For {area.name}, reduced driver pool from {count_before} to {len(available_drivers)} after filtering out females")
            
            # Sort drivers for assignment (prefer those with no previous zone/area assignment)
            prioritized_drivers = []
            for driver in available_drivers:
                was_previous_zone, was_previous_area = self._check_previous_assignment(driver, area)
                prioritized_drivers.append((driver, was_previous_zone, was_previous_area))
                
            # Sort prioritized drivers: prefer no repetition, then zone repetition, then area repetition
            # This matches the allocation strategy for other ranks
            prioritized_drivers.sort(key=lambda x: (1 if x[1] else 0, 1 if x[2] else 0))
            
            # Assign drivers according to priority and count needed
            to_assign = min(count, len(prioritized_drivers))
            
            # If we're still short on drivers but have some available, relax the repetition constraints
            if to_assign < count and self.verbose:
                print(f"PRIORITY OVERRIDE: Area {area.name} has critical driver shortage. Will attempt to assign with repetition.")
                # Use all available drivers, even if it means repetition
                if available_drivers:
                    to_assign = min(count, len(available_drivers))
            
            if self.verbose:
                print(f"DEBUG: Attempting to assign {to_assign} of {count} requested drivers to {area.name}")
                
            for i in range(to_assign):
                if i < len(prioritized_drivers):
                    driver, was_previous_zone, was_previous_area = prioritized_drivers[i]
                    
                    # Double-check we're not assigning a female to restricted area
                    if is_restricted and self._is_female_officer(driver):
                        print(f"ERROR PREVENTION: Attempted to assign female driver {driver.name} to restricted area {area.name}. Skipping.")
                        continue
                    
                    driver_assignments.append({
                        'officer': driver,
                        'was_previous_zone': was_previous_zone,
                        'was_previous_area': was_previous_area
                    })
                    
                    # Update repetition counters
                    if was_previous_zone:
                        self.repetition_count += 1
                    if was_previous_area:
                        self.same_area_repetition_count += 1
                    
                    # Mark this officer as assigned
                    self.assigned_officers.add(driver.id)
                    
            if len(driver_assignments) < count:
                if self.verbose:
                    print(f"WARNING: Could only fulfill {len(driver_assignments)} of {count} driver requirements for area {area.name}")
        
        return driver_assignments
    
    def _check_previous_assignment(self, officer, area):
        """Check if an officer was previously assigned to this zone or area"""
        was_previous_zone = False
        was_previous_area = False
        
        if officer.id in self.previous_assignments:
            prev_zone_id, prev_area_id = self.previous_assignments[officer.id]
            
            # Check if the officer was in the same zone
            if prev_zone_id == area.zone_id:
                was_previous_zone = True
                
                # Check if the officer was in the same area
                if prev_area_id == area.id:
                    was_previous_area = True
        
        return was_previous_zone, was_previous_area
    
    def _format_unfulfilled_requirements(self):
        """Format unfulfilled requirements for storage"""
        formatted_requirements = []
        total_missing = defaultdict(int)
        
        for item in self.incomplete_assignments:
            area = item['area']
            unfulfilled = item['unfulfilled']
            
            # Format the unfulfilled requirements
            req_details = []
            for rank, count in unfulfilled.items():
                rank_display = self._get_rank_display(rank)
                req_details.append({"rank": rank, "display": rank_display, "count": count})
                total_missing[rank] += count
            
            formatted_requirements.append({
                "area_id": area.id,
                "area_name": area.name,
                "zone_id": area.zone_id,
                "zone_name": area.zone.name,
                "unfulfilled": req_details
            })
        
        # Format total missing personnel
        total_details = []
        for rank, count in total_missing.items():
            rank_display = self._get_rank_display(rank)
            total_details.append({"rank": rank, "display": rank_display, "count": count})
        
        return {
            "areas": formatted_requirements,
            "totals": total_details
        }
    
    def _get_rank_display(self, rank):
        """Convert rank code to display name"""
        rank_display_map = {
            'SI': 'Sub Inspector',
            'ASI': 'Asst. Sub Inspector',
            'HC': 'Head Constable',
            'CONST': 'Constable',
            'HG': 'Home Guard',
            'DRIVER': 'Driver',
            'SENIOR': 'Senior Officer'
        }
        return rank_display_map.get(rank, rank)

    def _is_restricted_area(self, area):
        """Check if an area is restricted for female officers"""
        call_sign = area.call_sign.strip() if area.call_sign else ""
        
        # Check exact match first
        is_restricted = call_sign in self.RESTRICTED_AREAS
        
        # If not restricted by exact match, check if any restricted call sign prefix matches
        if not is_restricted:
            for restricted in self.RESTRICTED_AREAS:
                if call_sign.startswith(restricted.split(' ')[0]):  # Check first part (e.g., "Rhino" in "Rhino-01")
                    is_restricted = True
                    print(f"DEBUG: Area {area.name} with call sign '{call_sign}' is restricted due to prefix match with '{restricted}'")
                    break
        
        # Always print debug info for restricted areas
        if is_restricted:
            print(f"DEBUG: Area {area.name} with call sign '{call_sign}' IS RESTRICTED for female officers")
        elif self.verbose:
            print(f"DEBUG: Area {area.name} with call sign '{call_sign}' is not restricted")
            
        return is_restricted
    
    def _is_female_officer(self, officer):
        """Check if an officer is female based on gender field"""
        # Check all possible female gender representations
        is_female = officer.gender in ['F', 'Female', 'female', 'f']
        
        # Check if name contains female indicators (L/C typically indicates Lady Constable)
        if not is_female and officer.name:
            is_female = 'L/C' in officer.name or 'L/Const' in officer.name or 'Lady Const' in officer.name
        
        if self.verbose or is_female:
            print(f"DEBUG: Officer {officer.name} has gender '{officer.gender}', is_female={is_female}")
        return is_female

    def _format_reserved_officers(self):
        """Format reserved officers by rank for storage"""
        reserved_by_rank = defaultdict(list)
        ranks_count = defaultdict(int)
        
        for officer in self.reserved_officers:
            rank = officer.rank
            # Ensure all fields are primitive JSON-serializable types
            officer_data = {
                "id": officer.id,
                "name": str(officer.name),
                "belt_no": str(officer.belt_no) if officer.belt_no else "",
                "is_driver": bool(officer.is_driver)
            }
            reserved_by_rank[rank].append(officer_data)
            ranks_count[rank] += 1
        
        # Convert to the format needed for storage
        result = {
            "officers": [
                {
                    "rank": str(rank),
                    "display": str(self._get_rank_display(rank)),
                    "count": int(len(officers)),
                    "officers": officers
                }
                for rank, officers in reserved_by_rank.items()
            ],
            "totals": [
                {
                    "rank": str(rank),
                    "display": str(self._get_rank_display(rank)),
                    "count": int(count)
                }
                for rank, count in ranks_count.items()
            ]
        }
        
        return result

    def _allocate_officers(self, rank, officers_pool, count, area):
        """Allocate a specific number of officers of a given rank to an area"""
        assignments = []
        
        # Check if area has restricted call sign for female employees
        is_restricted = self._is_restricted_area(area)
        
        # Special handling for SIs and other senior officers
        is_senior_rank = rank in ['SI', 'ASI', 'HC']
        is_critical_rank = rank in ['SI', 'DRIVER'] or rank == 'HG'  # Home Guards now considered critical too
        
        # Debug output for allocation request
        if self.verbose or count > 0:
            print(f"DEBUG: Allocating {count} officers of rank {rank} to area {area.name} (restricted: {is_restricted})")
            print(f"DEBUG: Initial pool size for rank {rank}: {len(officers_pool)}")
        
        # Special handling for Home Guards - if we don't have enough in the pool
        if rank == 'HG' and len(officers_pool) < count and self.verbose:
            # Try to get more Home Guards directly from database
            more_home_guards_query = Policeman.objects.filter(
                rank='HG',
                preferred_duty='FIELD',
                has_fixed_duty=False
            ).exclude(
                id__in=list(self.assigned_officers)
            )
            
            # Filter out female officers for restricted areas
            if is_restricted:
                print(f"RESTRICTED AREA DB QUERY: Filtering out female Home Guards for {area.name}")
                more_home_guards_query = more_home_guards_query.exclude(gender='F')
                
            more_home_guards = list(more_home_guards_query)
            if more_home_guards:
                officers_pool = list(officers_pool) + more_home_guards
                print(f"DEBUG: Added {len(more_home_guards)} more Home Guards, new pool size: {len(officers_pool)}")
        
        # Filter out officers already assigned to this roster
        available_officers = [o for o in officers_pool if o.id not in self.assigned_officers]
        
        # Count before gender filtering
        count_before = len(available_officers)
        
        # Filter out female officers if this is a restricted area
        if is_restricted:
            # Store female officers separately for debugging
            female_officers = [o for o in available_officers if self._is_female_officer(o)]
            if female_officers and (self.verbose or count > 0):
                print(f"RESTRICTED AREA: Filtering out {len(female_officers)} female officers of rank {rank} from allocation pool for {area.name}")
                for female in female_officers[:5]:  # Show first 5 for brevity
                    print(f"  - Excluded female officer: {female.name} (rank: {female.rank}, gender: {female.gender})")
                if len(female_officers) > 5:
                    print(f"  - ... and {len(female_officers) - 5} more female officers excluded")
            
            available_officers = [o for o in available_officers if not self._is_female_officer(o)]
            
            # Print results of filtering
            if self.verbose or count > 0:
                print(f"RESTRICTED AREA: For {area.name}, reduced {rank} officer pool from {count_before} to {len(available_officers)} after filtering out females")
        
        # Categorize officers by previous assignment status
        no_repetition = []
        zone_repetition = []
        area_repetition = []
        
        for officer in available_officers:
            was_previous_zone, was_previous_area = self._check_previous_assignment(officer, area)
            
            if was_previous_area:
                area_repetition.append((officer, was_previous_zone, was_previous_area))
            elif was_previous_zone:
                zone_repetition.append((officer, was_previous_zone, was_previous_area))
            else:
                no_repetition.append((officer, was_previous_zone, was_previous_area))
        
        # For critical ranks (SI, HG, drivers), ensure we allocate even if it means repetition
        if is_critical_rank and count > 0:
            if self.verbose:
                print(f"DEBUG: Special allocation for critical rank {rank}")
                print(f"DEBUG: No repetition: {len(no_repetition)}, Zone repetition: {len(zone_repetition)}, Area repetition: {len(area_repetition)}")
        
        # Combine all categories in priority order
        prioritized_officers = no_repetition + zone_repetition + area_repetition
        
        # Assign officers according to priority and count needed
        to_assign = min(count, len(prioritized_officers))
        
        # If we're still short on officers for critical ranks but have some available, relax the repetition constraints
        if is_critical_rank and to_assign < count and available_officers:
            if self.verbose:
                print(f"PRIORITY OVERRIDE: Critical rank {rank} shortage. Will attempt to assign with repetition.")
            # Use all available officers, even if it means repetition
            to_assign = min(count, len(available_officers))
        
        if self.verbose or count > 0:
            print(f"DEBUG: Attempting to assign {to_assign} of {count} requested {rank} officers to {area.name}")
        
        for i in range(to_assign):
            if i < len(prioritized_officers):
                officer, was_previous_zone, was_previous_area = prioritized_officers[i]
            else:
                # If we've exhausted prioritized officers but need more for critical ranks
                officer = available_officers[i]
                was_previous_zone, was_previous_area = self._check_previous_assignment(officer, area)
            
            # Double-check we're not assigning a female to restricted area
            if is_restricted and self._is_female_officer(officer):
                print(f"ERROR PREVENTION: Attempted to assign female officer {officer.name} (rank: {rank}) to restricted area {area.name}. Skipping.")
                continue
                
            assignments.append({
                'officer': officer,
                'was_previous_zone': was_previous_zone,
                'was_previous_area': was_previous_area
            })
            
            # Update tracking
            self.assigned_officers.add(officer.id)
            if was_previous_zone:
                self.repetition_count += 1
            if was_previous_area:
                self.same_area_repetition_count += 1
        
        # Final check if we managed to fill all requirements
        if len(assignments) < count and self.verbose:
            print(f"WARNING: Could not fulfill all requirements for rank {rank} in area {area.name}. Needed {count}, assigned {len(assignments)}")
        
        return assignments


class Command(BaseCommand):
    help = 'Generates a police duty roster based on deployments'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name',
            type=str,
            help='Custom name for the roster'
        )
        parser.add_argument(
            '--activate',
            action='store_true',
            help='Activate the roster immediately instead of leaving it pending'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Display detailed information about the generation process'
        )

    def handle(self, *args, **options):
        try:
            self.stdout.write(self.style.SUCCESS('Starting roster generation...'))
            
            # Create the generator with verbose flag
            generator = RosterGenerator(verbose=options.get('verbose', False))
            
            # Generate the roster
            roster = generator.generate_roster(
                name=options.get('name'),
                pending=not options.get('activate')
            )
            
            self.stdout.write(self.style.SUCCESS(f'Successfully generated roster "{roster.name}" (ID: {roster.id})'))
            
            # Display statistics
            self.stdout.write(f'Total assignments: {roster.assignments.count()}')
            self.stdout.write(f'Zone repetitions: {roster.repetition_count}')
            self.stdout.write(f'Area repetitions: {roster.same_area_repetition_count}')
            
            # Display areas with incomplete assignments
            if generator.incomplete_assignments:
                self._display_unfulfilled_requirements(generator)
            else:
                self.stdout.write(self.style.SUCCESS('\nAll area requirements were fulfilled'))
            
            # Display reserved officers
            if generator.reserved_officers:
                self._display_reserved_officers(generator, verbose=options.get('verbose', False))
            
            if options.get('verbose'):
                self._display_detailed_assignments(roster)
            
            status = "Active" if not roster.is_pending else "Pending (needs confirmation)"
            self.stdout.write(f'\nRoster status: {status}')
            
            if roster.is_pending:
                self.stdout.write(
                    '\nTo activate this roster, use the web API or run: '
                    f'python manage.py confirm_roster {roster.id} --action=save'
                )
            
            # Store the roster ID as a string before returning
            return str(roster.id)
            
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error generating roster: {str(e)}'))
            raise CommandError(f'Failed to generate roster: {str(e)}')
    
    def _display_unfulfilled_requirements(self, generator):
        """Display areas with unfulfilled requirements"""
        self.stdout.write(self.style.WARNING('\nAreas with unfulfilled requirements:'))
        for item in generator.incomplete_assignments:
            area = item['area']
            unfulfilled = item['unfulfilled']
            
            # Build a readable representation of unfulfilled requirements
            req_details = []
            for rank, count in unfulfilled.items():
                rank_display = generator._get_rank_display(rank)
                req_details.append(f"{rank_display}: {count}")
            
            self.stdout.write(f"  {area.name} ({area.zone.name}) - Missing: {', '.join(req_details)}")
        
        # Count total missing personnel
        total_missing = defaultdict(int)
        for item in generator.incomplete_assignments:
            for rank, count in item['unfulfilled'].items():
                total_missing[rank] += count
        
        missing_details = []
        for rank, count in total_missing.items():
            rank_display = generator._get_rank_display(rank)
            missing_details.append(f"{rank_display}: {count}")
        
        self.stdout.write(self.style.WARNING(f"\nTotal unfulfilled requirements: {', '.join(missing_details)}"))
    
    def _display_reserved_officers(self, generator, verbose=False):
        """Display reserved (unused) officers with detailed information"""
        if not generator.reserved_officers:
            return
        
        self.stdout.write(self.style.SUCCESS('\nReserved Officers (Not Assigned):'))
        
        # Group by rank for easier reading
        reserved_by_rank = defaultdict(list)
        for officer in generator.reserved_officers:
            reserved_by_rank[officer.get_rank_display()].append(officer)
        
        # Count and display officers by rank with details
        for rank, officers in sorted(reserved_by_rank.items()):
            self.stdout.write(f"\n  {rank} ({len(officers)} officers):")
            
            # Show details for each officer
            for officer in officers:
                gender_info = f"({officer.gender})" if officer.gender else ""
                driver_info = "(Driver)" if officer.is_driver else ""
                belt_info = f"Belt#{officer.belt_no}" if officer.belt_no else "No Belt#"
                
                # Format the display line with all information
                details = [d for d in [gender_info, driver_info, belt_info] if d]  # Filter out empty strings
                details_str = " ".join(details)
                
                self.stdout.write(f"    - {officer.name:<30} {details_str}")
        
        # Show grand total with breakdown
        self.stdout.write(self.style.SUCCESS(f"\nTotal Reserved Officers: {len(generator.reserved_officers)}"))
        
        # Show gender breakdown
        female_count = sum(1 for o in generator.reserved_officers if generator._is_female_officer(o))
        male_count = len(generator.reserved_officers) - female_count
        self.stdout.write(f"Gender Distribution: {male_count} Male, {female_count} Female")
        
        # Show driver breakdown
        driver_count = sum(1 for o in generator.reserved_officers if o.is_driver)
        self.stdout.write(f"Drivers: {driver_count} of {len(generator.reserved_officers)}")
    
    def _display_detailed_assignments(self, roster):
        """Display detailed assignment information"""
        self.stdout.write('\nAssignments:')
        assignments = roster.assignments.all().select_related('policeman', 'area', 'area__zone')
        
        for assignment in assignments:
            repetition_info = []
            if assignment.was_previous_zone:
                repetition_info.append('Same Zone')
            if assignment.was_previous_area:
                repetition_info.append('Same Area')
            
            repetition_str = f" ({', '.join(repetition_info)})" if repetition_info else ""
            
            self.stdout.write(
                f"  {assignment.policeman.name} ({assignment.policeman.get_rank_display()}) → "
                f"{assignment.area.name} ({assignment.area.zone.name}){repetition_str}"
            ) 
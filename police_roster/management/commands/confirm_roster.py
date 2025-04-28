from django.core.management.base import BaseCommand, CommandError
from police_roster.models import Roster, RosterAssignment, PreviousRoster
from police_roster.serializers import RosterSerializer

class Command(BaseCommand):
    help = 'Confirm a pending roster by saving or discarding it'

    def add_arguments(self, parser):
        parser.add_argument(
            'roster_id',
            type=int,
            help='ID of the roster to confirm'
        )
        
        parser.add_argument(
            '--action',
            type=str,
            choices=['save', 'discard'],
            default='save',
            help='Action to take: save or discard the roster'
        )

    def handle(self, *args, **options):
        roster_id = options['roster_id']
        action = options['action']
        
        try:
            # Find the roster
            try:
                roster = Roster.objects.get(id=roster_id)
            except Roster.DoesNotExist:
                raise CommandError(f'Roster with ID {roster_id} does not exist')
            
            # Check if it's pending
            if not roster.is_pending:
                self.stdout.write(self.style.WARNING(f'Roster #{roster_id} is not pending (status: {"active" if roster.is_active else "inactive"})'))
                return
            
            if action == 'save':
                # Save to PreviousRoster first
                # Create a serialized version of all roster data
                serializer = RosterSerializer(roster)
                # Convert to Python dict to ensure we're not passing any unexpected types
                roster_data = dict(serializer.data)
                
                # Create a PreviousRoster entry
                PreviousRoster.objects.create(
                    name=roster.name,
                    created_at=roster.created_at,
                    repetition_count=roster.repetition_count,
                    same_area_repetition_count=roster.same_area_repetition_count,
                    unfulfilled_requirements=roster.unfulfilled_requirements,
                    roster_data=roster_data
                )
                
                # Activate the roster
                roster.is_pending = False
                roster.is_active = True
                roster.save()
                
                self.stdout.write(self.style.SUCCESS(f'Roster #{roster_id} "{roster.name}" has been activated and stored in PreviousRoster'))
                
                # Display some stats
                self.stdout.write(f'Total assignments: {roster.assignments.count()}')
                self.stdout.write(f'Zone repetitions: {roster.repetition_count}')
                self.stdout.write(f'Area repetitions: {roster.same_area_repetition_count}')
                
            elif action == 'discard':
                # Get the roster name before deleting
                roster_name = roster.name
                
                # Delete the roster and its assignments
                roster.delete()
                
                self.stdout.write(self.style.SUCCESS(f'Roster #{roster_id} "{roster_name}" has been discarded'))
                
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error confirming roster: {str(e)}'))
            raise CommandError(f'Failed to confirm roster: {str(e)}') 
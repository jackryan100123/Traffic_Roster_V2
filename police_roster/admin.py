from django.contrib import admin
from .models import Zone, Area, Policeman, Deployment, Roster, RosterAssignment, PreviousRoster, CorrigendumChange


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('name', 'zone', 'call_sign', 'vehicle_no')
    list_filter = ('zone',)
    search_fields = ('name', 'call_sign', 'vehicle_no')


@admin.register(Policeman)
class PolicemanAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'belt_no', 'rank', 'get_gender_display', 'get_driver_status',
        'preferred_duty', 'has_fixed_duty', 'fixed_area'
    )
    list_filter = (
        'rank', 'gender', 'is_driver', 'preferred_duty',
        'has_fixed_duty', 'fixed_area__zone', 'fixed_area'
    )
    search_fields = ('name', 'belt_no')
    raw_id_fields = ('fixed_area',)

    fieldsets = (
        (None, {
            'fields': ('name', 'belt_no', 'rank', 'gender')
        }),
        ('Duty Information', {
            'fields': ('is_driver', 'preferred_duty', 'specialized_duty')
        }),
        ('Fixed Duty', {
            'fields': ('has_fixed_duty', 'fixed_area')
        }),
    )

    @admin.display(description="Gender")
    def get_gender_display(self, obj):
        return dict(obj.GENDER_CHOICES).get(obj.gender, '-')

    @admin.display(boolean=True, description="Driver")
    def get_driver_status(self, obj):
        return obj.is_driver


@admin.register(Deployment)
class DeploymentAdmin(admin.ModelAdmin):
    list_display = (
        'area', 'si_count', 'asi_count', 'hc_count', 'constable_count',
        'hgv_count', 'driver_count', 'senior_count', 'created_at'
    )
    list_filter = ('area__zone', 'area')
    date_hierarchy = 'created_at'


class RosterAssignmentInline(admin.TabularInline):
    model = RosterAssignment
    extra = 0
    fields = ('area', 'policeman', 'was_previous_zone', 'was_previous_area')
    raw_id_fields = ('area', 'policeman')
    readonly_fields = ('was_previous_zone', 'was_previous_area')


@admin.register(Roster)
class RosterAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'created_at', 'get_status', 'assignment_count',
        'repetition_count', 'same_area_repetition_count', 'has_unfulfilled_requirements'
    )
    list_filter = ('is_active', 'is_pending', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('repetition_count', 'same_area_repetition_count', 'unfulfilled_requirements')
    date_hierarchy = 'created_at'
    inlines = [RosterAssignmentInline]

    @admin.display(description="Status")
    def get_status(self, obj):
        if obj.is_pending:
            return "Pending"
        elif obj.is_active:
            return "Active"
        else:
            return "Inactive"
    
    @admin.display(description="Assignments")
    def assignment_count(self, obj):
        return obj.assignments.count()
    
    @admin.display(boolean=True, description="Missing Staff")
    def has_unfulfilled_requirements(self, obj):
        return obj.unfulfilled_requirements is not None and obj.unfulfilled_requirements != {}


@admin.register(RosterAssignment)
class RosterAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'roster', 'area', 'policeman', 'was_previous_zone', 'was_previous_area'
    )
    list_filter = (
        'roster', 'area__zone', 'area', 'was_previous_zone', 'was_previous_area'
    )
    search_fields = ('policeman__name', 'policeman__belt_no', 'area__name')
    raw_id_fields = ('roster', 'area', 'policeman')


@admin.register(PreviousRoster)
class PreviousRosterAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'created_at', 'archived_at', 
        'repetition_count', 'same_area_repetition_count', 'has_unfulfilled_requirements'
    )
    list_filter = ('created_at', 'archived_at')
    search_fields = ('name',)
    readonly_fields = ('name', 'created_at', 'archived_at', 'repetition_count', 
                        'same_area_repetition_count', 'unfulfilled_requirements', 'roster_data')
    date_hierarchy = 'archived_at'
    
    @admin.display(boolean=True, description="Missing Staff")
    def has_unfulfilled_requirements(self, obj):
        return obj.unfulfilled_requirements is not None and obj.unfulfilled_requirements != {}


@admin.register(CorrigendumChange)
class CorrigendumChangeAdmin(admin.ModelAdmin):
    list_display = (
        'roster', 'policeman', 'area', 'created_at', 'get_zone', 'has_notes'
    )
    list_filter = (
        'created_at',
        'roster',
        'area__zone',
        'policeman__rank',
    )
    search_fields = (
        'policeman__name',
        'policeman__belt_no',
        'area__name',
        'area__call_sign',
        'notes'
    )
    raw_id_fields = ('roster', 'policeman', 'area')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Zone')
    def get_zone(self, obj):
        return obj.area.zone.name if obj.area and obj.area.zone else '-'

    @admin.display(boolean=True, description='Has Notes')
    def has_notes(self, obj):
        return bool(obj.notes)



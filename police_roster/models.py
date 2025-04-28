# models.py

from django.db import models
from django.contrib.auth.models import User
import json
from datetime import datetime

class Zone(models.Model):
    """Represents a police zone (Central, East, etc.)"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class Area(models.Model):
    """Represents an area within a zone"""
    zone = models.ForeignKey(Zone, related_name='areas', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    call_sign = models.CharField(max_length=50)
    vehicle_no = models.CharField(max_length=20, blank=True, null=True)
    
    def __str__(self):
        return f"{self.name} ({self.zone.name})"

class Policeman(models.Model):
    """Represents a police officer"""
    RANK_CHOICES = [
        ('INSP', 'Inspector'),
        ('SI', 'Sub Inspector'),
        ('ASI', 'Assistant Sub Inspector'),
        ('HC', 'Head Constable'),
        ('CONST', 'Constable'),
        ('HG', 'Home Guard'),
    ]
    
    DUTY_CHOICES = [
        ('STATIC', 'Static'),
        ('FIELD', 'Field'),
    ]

    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
    ]
    
    name = models.CharField(max_length=100)
    belt_no = models.CharField(max_length=50, unique=True)
    rank = models.CharField(max_length=10, choices=RANK_CHOICES)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    is_driver = models.BooleanField(default=False)
    preferred_duty = models.CharField(max_length=10, choices=DUTY_CHOICES, default='FIELD')
    specialized_duty = models.CharField(max_length=100, blank=True, null=True)
    has_fixed_duty = models.BooleanField(default=False)
    fixed_area = models.ForeignKey('Area', on_delete=models.SET_NULL, null=True, blank=True, related_name='fixed_duty_officers')
    
    def __str__(self):
        return f"{self.name} ({self.belt_no}) - {self.get_rank_display()}"
    
    @property
    def is_senior(self):
        """Return True if officer is a senior rank (SI, ASI, HC)"""
        return self.rank in ['SI', 'ASI', 'HC']
    
    @property
    def is_home_guard(self):
        """Return True if officer is a Home Guard"""
        return self.rank == 'HG'
    
    @property
    def effective_duty(self):
        """Return the effective duty type, with special handling for Home Guards
        Home Guards are always considered available for field duty regardless of their preferred_duty setting"""
        if self.rank == 'HG':
            return 'FIELD'  # Home Guards are always available for field duty
        return self.preferred_duty
        
    def clean(self):
        """Validate that fixed_area is set if has_fixed_duty is True"""
        from django.core.exceptions import ValidationError
        
        if self.has_fixed_duty and not self.fixed_area:
            raise ValidationError({'fixed_area': 'Fixed area must be specified for officers with fixed duty.'})
            
    def save(self, *args, **kwargs):
        """Ensure fixed_area is cleared if has_fixed_duty is False"""
        if not self.has_fixed_duty:
            self.fixed_area = None
        super().save(*args, **kwargs)

class Deployment(models.Model):
    """Represents required personnel deployment for an area"""
    area = models.ForeignKey(Area, related_name='deployments', on_delete=models.SET_NULL, null=True)
    si_count = models.PositiveIntegerField(default=0)
    asi_count = models.PositiveIntegerField(default=0)
    hc_count = models.PositiveIntegerField(default=0)
    constable_count = models.PositiveIntegerField(default=0)
    hgv_count = models.PositiveIntegerField(default=0)  # HGVs (Home Guard Volunteers)
    driver_count = models.PositiveIntegerField(default=0)  # Drivers
    senior_count = models.PositiveIntegerField(default=0)  # Count of senior officers
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Deployment for {self.area} - Updated: {self.updated_at.date()}"

class Roster(models.Model):
    """Represents a generated roster with assignments"""
    name = models.CharField(max_length=100, default=f"Roster {datetime.now().strftime('%Y-%m-%d')}")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)
    is_pending = models.BooleanField(default=True)
    repetition_count = models.PositiveIntegerField(default=0)  # Count of officers assigned to same zone
    same_area_repetition_count = models.PositiveIntegerField(default=0)  # Count of officers assigned to same area
    unfulfilled_requirements = models.JSONField(null=True, blank=True)  # Areas with unfulfilled requirements
    
    def __str__(self):
        status = "Pending" if self.is_pending else "Active" if self.is_active else "Inactive"
        return f"{self.name} ({self.created_at.strftime('%Y-%m-%d')}) - {status}"

class RosterAssignment(models.Model):
    """Represents a single assignment in a roster"""
    roster = models.ForeignKey(Roster, related_name='assignments', on_delete=models.CASCADE)
    area = models.ForeignKey(Area, related_name='roster_assignments', on_delete=models.CASCADE)
    policeman = models.ForeignKey(Policeman, related_name='roster_assignments', on_delete=models.CASCADE)
    was_previous_zone = models.BooleanField(default=False)  # Flag if officer was in same zone in previous roster
    was_previous_area = models.BooleanField(default=False)  # Flag if officer was in same area in previous roster
    
    def __str__(self):
        return f"{self.policeman.name} assigned to {self.area.name}"
        
    class Meta:
        unique_together = ('roster', 'policeman')  # One officer cannot be assigned twice in same roster

class PreviousRoster(models.Model):
    """Archive of previous rosters for reference"""
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField()
    archived_at = models.DateTimeField(auto_now_add=True)
    roster_data = models.JSONField()  # Stores serialized roster data
    repetition_count = models.PositiveIntegerField(default=0)
    same_area_repetition_count = models.PositiveIntegerField(default=0)
    unfulfilled_requirements = models.JSONField(null=True, blank=True)  # Areas with unfulfilled requirements
    
    def __str__(self):
        return f"Previous {self.name} ({self.created_at.strftime('%Y-%m-%d')})"

class CorrigendumChange(models.Model):
    """Model to track manual changes that should affect future roster generation"""
    roster = models.ForeignKey('PreviousRoster', on_delete=models.CASCADE, related_name='corrigendum_changes')
    policeman = models.ForeignKey('Policeman', on_delete=models.CASCADE)
    area = models.ForeignKey('Area', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Change for {self.policeman.name} to {self.area.name} on {self.created_at}"


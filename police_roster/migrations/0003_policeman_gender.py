# Generated by Django 5.2 on 2025-04-22 09:50

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("police_roster", "0002_policeman_fixed_area_policeman_has_fixed_duty"),
    ]

    operations = [
        migrations.AddField(
            model_name="policeman",
            name="gender",
            field=models.CharField(
                choices=[("M", "Male"), ("F", "Female")], default="M", max_length=1
            ),
        ),
    ]

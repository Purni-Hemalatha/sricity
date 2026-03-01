#!/usr/bin/env python
"""
Management command to populate demo exit data
Run: python manage.py populate_demo_exits
"""

from django.core.management.base import BaseCommand
from django.db import connection
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = 'Populate demo exit data for testing the exit workflow'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n🚀 Populating Demo Exit Data\n'))
        
        try:
            # Mark 2 employees as exited with different exit dates
            with connection.cursor() as cursor:
                # First, let's see how many employees we have
                cursor.execute("SELECT COUNT(*) as cnt FROM emp_master WHERE end_date IS NULL")
                result = cursor.fetchone()
                active_count = result[0] if result else 0
                
                self.stdout.write(f"Total Active Employees: {active_count}")
                
                if active_count < 2:
                    self.stdout.write(self.style.WARNING(
                        "Not enough active employees to mark as exited. "
                        "Creating demo employees first...\n"
                    ))
                    # Create some demo employees
                    demo_employees = [
                        ('Amit', 'Kumar', 'Singh', '2022-01-15'),
                        ('Priya', 'Sharma', None, '2021-06-20'),
                        ('Rahul', 'Patel', 'Kumar', '2020-03-10'),
                        ('Isha', 'Verma', None, '2023-02-01'),
                        ('Vikas', 'Gupta', 'Singh', '2019-09-05'),
                    ]
                    
                    for fname, lname, mname, start_date in demo_employees:
                        cursor.execute(
                            """INSERT INTO emp_master (first_name, middle_name, last_name, start_date)
                               VALUES (%s, %s, %s, %s)""",
                            [fname, mname, lname, start_date]
                        )
                    self.stdout.write(self.style.SUCCESS(f"✅ Created {len(demo_employees)} demo employees\n"))
                
                # Now mark some as exited
                exit_data = [
                    {
                        'name': 'Vikas Gupta Singh',
                        'exit_date': (datetime.now() - timedelta(days=45)).date(),
                        'reason': 'Voluntary resignation'
                    },
                    {
                        'name': 'Priya Sharma',
                        'exit_date': (datetime.now() - timedelta(days=15)).date(),
                        'reason': 'Relocation'
                    },
                ]
                
                for emp_data in exit_data:
                    # Find employee by name
                    names = emp_data['name'].split()
                    first_name = names[0]
                    last_name = names[-1]
                    
                    cursor.execute(
                        """UPDATE emp_master 
                           SET end_date = %s 
                           WHERE first_name = %s AND last_name = %s AND end_date IS NULL
                           LIMIT 1""",
                        [emp_data['exit_date'], first_name, last_name]
                    )
                    
                    if cursor.rowcount > 0:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"✅ Marked {emp_data['name']} as exited on {emp_data['exit_date']}"
                            )
                        )
                        self.stdout.write(f"   Reason: {emp_data['reason']}\n")
                    else:
                        self.stdout.write(
                            self.style.WARNING(f"⚠️  Could not find employee: {emp_data['name']}\n")
                        )
                
                # Show summary
                cursor.execute(
                    """SELECT 
                        SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN end_date IS NOT NULL THEN 1 ELSE 0 END) as exited
                       FROM emp_master"""
                )
                row = cursor.fetchone()
                active, exited = row[0] or 0, row[1] or 0
                
                self.stdout.write("\n" + "="*60)
                self.stdout.write(self.style.SUCCESS("📊 Employee Status Summary"))
                self.stdout.write("="*60)
                self.stdout.write(f"✅ Active Employees:  {active}")
                self.stdout.write(f"❌ Exited Employees:  {exited}")
                self.stdout.write(f"💼 Total Employees:   {active + exited}")
                self.stdout.write("="*60 + "\n")
                
                self.stdout.write(self.style.SUCCESS("✨ Demo exit data populated successfully!\n"))
                self.stdout.write("You can now:\n")
                self.stdout.write("1. Visit the Employee Directory on the frontend\n")
                self.stdout.write("2. Use the Status filter to view Active vs Exited employees\n")
                self.stdout.write("3. Click on an active employee and use 'Exit Employee' button\n")
                self.stdout.write("4. Enter the last working day and confirm\n")
                self.stdout.write("5. The employee will move to 'Exited' status\n\n")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error: {str(e)}\n")
            )
            import traceback
            traceback.print_exc()

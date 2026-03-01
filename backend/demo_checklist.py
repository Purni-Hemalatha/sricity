#!/usr/bin/env python
"""
Demo script to populate sample onboarding checklist data
Run this to create demo data showing different completion statuses
"""

import os
import sys
import django
from datetime import datetime, timedelta

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.utils import timezone
from hackathon.models import Employee, OnboardingChecklist

def create_demo_checklist():
    """Create demo onboarding checklist for the first employee"""
    
    # Get first employee or create one
    try:
        employee = Employee.objects.first()
        if not employee:
            print("No employees found. Please create an employee first.")
            return
    except Exception as e:
        print(f"Error fetching employee: {e}")
        return

    print(f"\n📋 Creating demo onboarding checklist for {employee.emp_id} - {employee.first_name} {employee.last_name}\n")

    # Define demo checklist items with mock data
    demo_items = [
        {
            'item_name': 'PAN_CARD',
            'is_completed': True,
            'document_url': 'https://example.com/documents/pan_card.pdf',
            'notes': 'PAN card scanned and uploaded - Verified by HR'
        },
        {
            'item_name': 'AADHAAR_CARD',
            'is_completed': True,
            'document_url': 'https://example.com/documents/aadhaar_card.pdf',
            'notes': 'Aadhaar card verified'
        },
        {
            'item_name': 'UAN_EPF',
            'is_completed': True,
            'document_url': 'https://example.com/documents/uan_epf.pdf',
            'notes': 'UAN/EPF account number provided'
        },
        {
            'item_name': 'ESI',
            'is_completed': False,
            'document_url': '',
            'notes': 'Awaiting ESI documentation'
        },
        {
            'item_name': 'BANK_DETAILS',
            'is_completed': True,
            'document_url': 'https://example.com/documents/bank_form.pdf',
            'notes': 'Bank details verified with salary account'
        },
        {
            'item_name': 'PASSPORT',
            'is_completed': False,
            'document_url': '',
            'notes': 'Pending'
        },
        {
            'item_name': 'DRIVING_LICENSE',
            'is_completed': False,
            'document_url': '',
            'notes': 'Optional document'
        },
        {
            'item_name': 'FORM_COMPLETED',
            'is_completed': True,
            'document_url': 'https://example.com/documents/onboarding_form.pdf',
            'notes': 'All sections completed and submitted'
        },
        {
            'item_name': 'DOCUMENTS_VERIFIED',
            'is_completed': True,
            'document_url': '',
            'notes': 'All required documents verified by HR on 2026-02-26'
        },
    ]

    # Create checklist items
    created_count = 0
    updated_count = 0

    for item_data in demo_items:
        try:
            item_name = item_data.pop('item_name')
            
            # Set completed date for completed items
            if item_data['is_completed']:
                completed_date = timezone.now() - timedelta(days=7)  # 7 days ago
            else:
                completed_date = None
            
            item_data['completed_date'] = completed_date
            
            checklist_item, created = OnboardingChecklist.objects.update_or_create(
                employee=employee,
                item_name=item_name,
                defaults=item_data
            )
            
            if created:
                created_count += 1
                status_icon = "✅" if item_data['is_completed'] else "⏳"
                print(f"{status_icon} Created: {checklist_item.get_item_name_display()}")
            else:
                updated_count += 1
                status_icon = "✅" if item_data['is_completed'] else "⏳"
                print(f"{status_icon} Updated: {checklist_item.get_item_name_display()}")
                
        except Exception as e:
            print(f"❌ Error creating item: {e}")

    # Calculate and display stats
    all_items = OnboardingChecklist.objects.filter(employee=employee)
    total = all_items.count()
    completed = all_items.filter(is_completed=True).count()
    percentage = (completed / total * 100) if total > 0 else 0

    print(f"\n" + "="*60)
    print(f"📊 Onboarding Progress Summary")
    print(f"="*60)
    print(f"Employee: {employee.emp_id} - {employee.first_name} {employee.last_name}")
    print(f"Total Items: {total}")
    print(f"Completed: {completed}")
    print(f"Pending: {total - completed}")
    print(f"Completion: {percentage:.1f}%")
    print(f"Created: {created_count} | Updated: {updated_count}")
    print(f"="*60 + "\n")

    return all_items

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Onboarding Checklist Demo Data Generator")
    print("="*60)
    
    try:
        checklist = create_demo_checklist()
        print("✅ Demo data created successfully!\n")
        print("You can now:")
        print("1. Visit the EmployeeProfile page in the frontend")
        print("2. Select an employee to see their onboarding checklist")
        print("3. Check/uncheck items to toggle completion")
        print("4. Add documents and notes to track progress")
        print("5. Watch the progress bar update in real-time\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()

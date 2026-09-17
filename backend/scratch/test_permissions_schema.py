from schemas.users import UserResponse

# Simulate what SQLAlchemy gives us — a raw JSON string from Text column
u = UserResponse.model_validate({
    'UserId': 1,
    'Username': 'cashier01',
    'IsActive': True,
    'Role': 'cashier',
    'Permissions': '["sales","purchases"]'
})
print("Cashier permissions:", u.Permissions)

# Admin with NULL permissions
u2 = UserResponse.model_validate({
    'UserId': 2,
    'Username': 'admin',
    'IsActive': True,
    'Role': 'admin',
    'Permissions': None
})
print("Admin permissions:", u2.Permissions)

# Empty string edge case
u3 = UserResponse.model_validate({
    'UserId': 3,
    'Username': 'cashier02',
    'IsActive': True,
    'Role': 'cashier',
    'Permissions': ''
})
print("Empty string permissions:", u3.Permissions)

print("ALL OK")
